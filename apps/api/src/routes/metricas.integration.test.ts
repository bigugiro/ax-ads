/**
 * Integração + RLS do Sprint 2 (roda contra o Supabase remoto).
 * Prova o DoD: o dashboard AGREGA o espelho corretamente (bate com os dados do
 * provider), sem contar campanha+conjunto+anúncio em dobro, e respeita o
 * isolamento por agência. Pula se o Supabase não estiver no ambiente.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { DashboardMetricas, Database, Papel } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { periodoUltimosDias } from '../lib/sync-espelho';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

interface Tenant {
  agenciaId: string;
  token: string;
}

function arred2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

describe.skipIf(!podeRodar)('métricas /dashboard — integração + RLS (Sprint 2)', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;

  async function provisionar(nomeAgencia: string, papel: Papel): Promise<Tenant> {
    const { data: ag } = await service
      .from('agencias')
      .insert({ nome: nomeAgencia })
      .select('id')
      .single()
      .throwOnError();
    agenciasCriadas.push(ag.id);

    const email = `t_${randomUUID()}@example.com`;
    const password = `Pw_${randomUUID().slice(0, 12)}`;
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr || !authData.user) throw authErr ?? new Error('auth user não criado');
    authUsersCriados.push(authData.user.id);

    await service
      .from('usuarios')
      .insert({
        agencia_id: ag.id,
        nome: 'Teste',
        email,
        papel,
        auth_supabase_id: authData.user.id,
      })
      .throwOnError();

    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess, error: sessErr } = await anon.auth.signInWithPassword({ email, password });
    if (sessErr || !sess.session) throw sessErr ?? new Error('login falhou');
    return { agenciaId: ag.id, token: sess.session.access_token };
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    gestorA = await provisionar('Agência A — métricas', 'gestor');
    gestorB = await provisionar('Agência B — métricas', 'gestor');
    viewerA = { ...(await provisionar('Agência A — métricas (viewer separado)', 'viewer')) };

    // Cliente + conta demo conectada em A (popula o espelho de 90 dias).
    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Métricas A' })
      .select('id')
      .single()
      .throwOnError();

    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: cli.id, plataforma: 'demo', external_account_id: 'demo-acc-aurora' });
    expect(res.status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('rejeita sem token (401)', async () => {
    const res = await request(app).get('/metricas/dashboard');
    expect(res.status).toBe(401);
  });

  it('valida a query (dias fora de faixa → 422)', async () => {
    const res = await request(app)
      .get('/metricas/dashboard?dias=999')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(422);
  });

  it('DoD: os totais do dashboard batem com o espelho (nível campanha, sem dobra)', async () => {
    const res = await request(app)
      .get('/metricas/dashboard?dias=30')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const dash = (res.body as { data: DashboardMetricas }).data;

    // Período que a rota usa (últimos 30 dias fechados).
    const periodo = periodoUltimosDias(30);
    expect(dash.periodo).toEqual(periodo);

    // Soma independente do espelho, SÓ nível campanha, no mesmo período.
    const { data: rowsCampanha } = await service
      .from('metricas_diarias')
      .select('gasto, receita, conversoes, impressoes, cliques')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade_tipo', 'campanha')
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim)
      .throwOnError();

    const esperado = (rowsCampanha ?? []).reduce(
      (acc, r) => ({
        gasto: acc.gasto + Number(r.gasto),
        receita: acc.receita + Number(r.receita),
        conversoes: acc.conversoes + r.conversoes,
        impressoes: acc.impressoes + r.impressoes,
        cliques: acc.cliques + r.cliques,
      }),
      { gasto: 0, receita: 0, conversoes: 0, impressoes: 0, cliques: 0 },
    );

    expect(dash.geral.atual.gasto).toBe(arred2(esperado.gasto));
    expect(dash.geral.atual.receita).toBe(arred2(esperado.receita));
    expect(dash.geral.atual.conversoes).toBe(esperado.conversoes);
    expect(dash.geral.atual.impressoes).toBe(esperado.impressoes);
    expect(dash.geral.atual.cliques).toBe(esperado.cliques);

    // ROAS coerente com os totais.
    if (esperado.gasto > 0) {
      expect(dash.geral.atual.roas).toBeCloseTo(esperado.receita / esperado.gasto, 2);
    }

    // Guarda contra dobra: somar TODAS as entidades daria bem mais que só campanha.
    const { data: rowsTodas } = await service
      .from('metricas_diarias')
      .select('gasto')
      .eq('agencia_id', gestorA.agenciaId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim)
      .throwOnError();
    const gastoTodas = (rowsTodas ?? []).reduce((s, r) => s + Number(r.gasto), 0);
    expect(gastoTodas).toBeGreaterThan(esperado.gasto * 1.5);

    // Quebras presentes e coerentes.
    expect(dash.porCliente.length).toBeGreaterThan(0);
    expect(dash.porCampanha.length).toBeGreaterThan(0);
    expect(dash.serie.length).toBeGreaterThan(0);
    const somaSerie = arred2(dash.serie.reduce((s, d) => s + d.gasto, 0));
    expect(somaSerie).toBe(dash.geral.atual.gasto);
  }, 60_000);

  it('viewer também enxerga o dashboard (ver_dashboard)', async () => {
    const res = await request(app)
      .get('/metricas/dashboard?dias=7')
      .set('Authorization', `Bearer ${viewerA.token}`);
    // Viewer de OUTRA agência (sem contas) → 200 e vazio, prova a permissão.
    expect(res.status).toBe(200);
  });

  it('isolamento RLS: tenant B não vê métricas de A (dashboard vazio)', async () => {
    const res = await request(app)
      .get('/metricas/dashboard?dias=30')
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(res.status).toBe(200);
    const dash = (res.body as { data: DashboardMetricas }).data;
    expect(dash.porCampanha).toHaveLength(0);
    expect(dash.geral.atual.gasto).toBe(0);
    expect(dash.geral.atual.roas).toBeNull();
  });

  it('filtro por cliente inexistente na agência → dashboard vazio', async () => {
    const res = await request(app)
      .get(`/metricas/dashboard?dias=30&cliente_id=${randomUUID()}`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const dash = (res.body as { data: DashboardMetricas }).data;
    expect(dash.porCampanha).toHaveLength(0);
  });
});
