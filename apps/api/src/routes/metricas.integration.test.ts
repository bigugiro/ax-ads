/**
 * Integração + RLS do Sprint 2 (roda contra o Supabase remoto).
 * Prova o DoD do dashboard: as métricas agregadas batem com o que o sync
 * populou, `ver_dashboard` libera viewer, e a RLS isola por agência.
 * Pula automaticamente se as variáveis do Supabase não estiverem no ambiente.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database, MetricasDerivadas, Papel } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

interface Tenant {
  usuarioId: string;
  token: string;
}

interface ResumoAgencia {
  periodo: { inicio: string; fim: string };
  total: MetricasDerivadas;
  porCliente: Array<{ cliente_id: string; nome: string; metricas: MetricasDerivadas }>;
}

describe.skipIf(!podeRodar)('métricas — dashboard, integração + RLS (Sprint 2)', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let agenciaA: string;
  let gestorA: Tenant;
  let viewerA: Tenant;
  let gestorB: Tenant;
  let clienteA: string;

  async function novaAgencia(nome: string): Promise<string> {
    const { data, error } = await service.from('agencias').insert({ nome }).select('id').single();
    if (error || !data) throw error ?? new Error('agência não criada');
    agenciasCriadas.push(data.id);
    return data.id;
  }

  async function novoUsuario(agenciaId: string, papel: Papel): Promise<Tenant> {
    const email = `t_${randomUUID()}@example.com`;
    const password = `Pw_${randomUUID().slice(0, 12)}`;
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr || !authData.user) throw authErr ?? new Error('auth user não criado');
    authUsersCriados.push(authData.user.id);

    const { data: u, error: uErr } = await service
      .from('usuarios')
      .insert({
        agencia_id: agenciaId,
        nome: 'Teste',
        email,
        papel,
        auth_supabase_id: authData.user.id,
      })
      .select('id')
      .single();
    if (uErr || !u) throw uErr ?? new Error('usuário não criado');

    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess, error: sessErr } = await anon.auth.signInWithPassword({ email, password });
    if (sessErr || !sess.session) throw sessErr ?? new Error('login falhou');
    return { usuarioId: u.id, token: sess.session.access_token };
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });

    agenciaA = await novaAgencia('Agência A — métricas');
    gestorA = await novoUsuario(agenciaA, 'gestor');
    viewerA = await novoUsuario(agenciaA, 'viewer');

    const agenciaB = await novaAgencia('Agência B — métricas');
    gestorB = await novoUsuario(agenciaB, 'gestor');

    const { data: cli, error } = await service
      .from('clientes')
      .insert({ agencia_id: agenciaA, nome: 'Loja Demo A' })
      .select('id')
      .single();
    if (error || !cli) throw error ?? new Error('cliente não criado');
    clienteA = cli.id;

    // Conecta uma conta demo → popula o espelho (campanhas/métricas) para agregar.
    const conectar = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'demo', external_account_id: 'demo-acc-aurora' });
    if (conectar.status !== 201) {
      throw new Error(`falha ao conectar conta demo: ${conectar.status}`);
    }
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('rejeita requisição sem token (401)', async () => {
    const res = await request(app).get('/metricas');
    expect(res.status).toBe(401);
  });

  it('gestor vê o resumo da agência com números coerentes com o sync', async () => {
    const res = await request(app).get('/metricas').set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const { data } = res.body as { data: ResumoAgencia };

    expect(data.total.gasto).toBeGreaterThan(0);
    expect(data.total.impressoes).toBeGreaterThan(0);
    expect(data.total.roas).not.toBeNull();
    // Funil coerente: cliques ≤ impressões, conversões ≤ cliques.
    expect(data.total.cliques).toBeLessThanOrEqual(data.total.impressoes);
    expect(data.total.conversoes).toBeLessThanOrEqual(data.total.cliques);

    const cliente = data.porCliente.find((c) => c.cliente_id === clienteA);
    expect(cliente).toBeDefined();
    expect(cliente!.metricas.gasto).toBeGreaterThan(0);
    // Só há um cliente com dados: a quebra bate com o total.
    expect(cliente!.metricas.gasto).toBe(data.total.gasto);
  });

  it('viewer também vê o dashboard (ver_dashboard = viewer+)', async () => {
    const res = await request(app).get('/metricas').set('Authorization', `Bearer ${viewerA.token}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: ResumoAgencia }).data.total.gasto).toBeGreaterThan(0);
  });

  it('período sem dados retorna zeros e ROAS null', async () => {
    const res = await request(app)
      .get('/metricas?inicio=2000-01-01&fim=2000-01-02')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const { data } = res.body as { data: ResumoAgencia };
    expect(data.total.gasto).toBe(0);
    expect(data.total.impressoes).toBe(0);
    expect(data.total.roas).toBeNull();
  });

  it('rejeita query com apenas um limite do período (422)', async () => {
    const res = await request(app)
      .get('/metricas?inicio=2026-01-01')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(422);
  });

  it('isolamento RLS: agência B vê resumo zerado e sem clientes de A', async () => {
    const res = await request(app).get('/metricas').set('Authorization', `Bearer ${gestorB.token}`);
    expect(res.status).toBe(200);
    const { data } = res.body as { data: ResumoAgencia };
    expect(data.total.gasto).toBe(0);
    expect(data.porCliente.some((c) => c.cliente_id === clienteA)).toBe(false);
  });

  it('campanhas do cliente trazem métricas por campanha e total consistente', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/campanhas`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const { data } = res.body as {
      data: {
        cliente: { id: string; nome: string };
        total: MetricasDerivadas;
        campanhas: Array<{ campanha: { id: string; nome: string }; metricas: MetricasDerivadas }>;
      };
    };

    expect(data.cliente.id).toBe(clienteA);
    expect(data.campanhas.length).toBeGreaterThan(0);
    expect(data.total.gasto).toBeGreaterThan(0);

    // A soma do gasto das campanhas reproduz o total do cliente.
    const somaCampanhas = data.campanhas.reduce((acc, c) => acc + c.metricas.gasto, 0);
    expect(Math.round(somaCampanhas * 100) / 100).toBe(data.total.gasto);
  });

  it('RLS: agência B não acessa campanhas do cliente de A (404)', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/campanhas`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(res.status).toBe(404);
  });
});
