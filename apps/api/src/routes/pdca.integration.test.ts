/**
 * Integração do motor PDCA (Sprint 7) — roda contra o Supabase remoto.
 * Prova o DoD: o cron detecta anomalias de CPA/ROAS a partir de métricas reais
 * do espelho, gera recomendação, e aprovar/aplicar uma recomendação de
 * "pausar_campanha" PAUSA A CAMPANHA DE VERDADE via AdsProvider (audit incluso).
 * Roda com ou sem `ANTHROPIC_API_KEY` — sem a chave, cai no fallback textual
 * (o cron não pode depender da IA para nunca falhar).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database, Papel } from '@ax-ads/shared';
import { janelaAnterior } from '@ax-ads/shared';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getProvider } from '../providers';
import { periodoUltimosDias } from '../lib/sync-espelho';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

const ACC = 'demo-acc-aurora';
const SECRET = `cron_${randomUUID()}`;

interface Tenant {
  agenciaId: string;
  token: string;
}

describe.skipIf(!podeRodar)('PDCA — Check/Act/Do (Sprint 7): integração + RLS', () => {
  let app: Express;
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let clienteId: string;
  let campanhaId: string;
  let campanhaNome: string;

  async function provisionar(nome: string, papel: Papel): Promise<Tenant> {
    const { data: ag } = await service
      .from('agencias')
      .insert({ nome })
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
    const { data: sess } = await anon.auth.signInWithPassword({ email, password });
    return { agenciaId: ag.id, token: sess.session!.access_token };
  }

  /** Insere direto (service role) linhas de métrica para forçar uma anomalia de CPA. */
  async function semearMetricas(agenciaId: string): Promise<void> {
    const atual = periodoUltimosDias(7);
    const anterior = janelaAnterior(atual);

    // O sync da conta demo já semeia métricas nesses dias — limpa antes de
    // controlar os totais do período (resumirLinhas soma todas as linhas).
    await service
      .from('metricas_diarias')
      .delete()
      .eq('entidade_id', campanhaId)
      .gte('data', anterior.inicio)
      .lte('data', atual.fim)
      .throwOnError();

    // Anterior: base estável, CPA baixo (10 conversões, gasto 500 → CPA 50).
    await service
      .from('metricas_diarias')
      .insert({
        agencia_id: agenciaId,
        entidade_tipo: 'campanha',
        entidade_id: campanhaId,
        data: anterior.fim,
        impressoes: 10_000,
        cliques: 500,
        gasto: 500,
        conversoes: 10,
        receita: 2000,
      })
      .throwOnError();

    // Atual: mesmo volume de conversões, gasto MUITO maior → CPA dispara (+300%).
    await service
      .from('metricas_diarias')
      .insert({
        agencia_id: agenciaId,
        entidade_tipo: 'campanha',
        entidade_id: campanhaId,
        data: atual.fim,
        impressoes: 10_000,
        cliques: 500,
        gasto: 2000,
        conversoes: 10,
        receita: 2000,
      })
      .throwOnError();
  }

  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET;
    const { createApp } = await import('../app');
    app = createApp();

    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    gestorA = await provisionar('Agência A — PDCA', 'gestor');
    gestorB = await provisionar('Agência B — PDCA', 'gestor');
    viewerA = await provisionar('Agência C — PDCA (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja PDCA' })
      .select('id')
      .single()
      .throwOnError();
    clienteId = cli.id;

    const conectar = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteId, plataforma: 'demo', external_account_id: ACC });
    expect(conectar.status).toBe(201);

    const campanhas = await request(app)
      .get('/campanhas')
      .set('Authorization', `Bearer ${gestorA.token}`);
    const primeira = (campanhas.body as { data: Array<{ id: string; nome: string }> }).data[0]!;
    campanhaId = primeira.id;
    campanhaNome = primeira.nome;

    await semearMetricas(gestorA.agenciaId);
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
    delete process.env.CRON_SECRET;
  }, 60_000);

  it('POST /cron/detectar-anomalias sem segredo → 401', async () => {
    const res = await request(app).post('/cron/detectar-anomalias');
    expect(res.status).toBe(401);
  });

  it('DoD Check/Act: cron detecta a anomalia de CPA e gera recomendação', async () => {
    const res = await request(app)
      .post('/cron/detectar-anomalias')
      .set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const resultado = (res.body as { data: { anomalias: number; recomendacoes: number } }).data;
    expect(resultado.anomalias).toBeGreaterThan(0);
    expect(resultado.recomendacoes).toBeGreaterThan(0);

    const { data: anomalias } = await service
      .from('anomalias')
      .select('metrica, severidade, campanha_id')
      .eq('cliente_id', clienteId)
      .throwOnError();
    expect(anomalias.some((a) => a.metrica === 'cpa' && a.campanha_id === campanhaId)).toBe(true);
  }, 60_000);

  it('GET /clientes/:id/anomalias exige token (401)', async () => {
    const res = await request(app).get(`/clientes/${clienteId}/anomalias`);
    expect(res.status).toBe(401);
  });

  it('tenant B não enxerga anomalias/recomendações de A (RLS)', async () => {
    const anomalias = await request(app)
      .get(`/clientes/${clienteId}/anomalias`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    // RLS filtra por agência: cliente de A não existe pra B (vazio, não erro).
    expect((anomalias.body as { data: unknown[] }).data).toEqual([]);
  });

  it('gestor A enxerga a recomendação sugerida', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteId}/recomendacoes`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (
      res.body as { data: Array<{ id: string; status: string; alvo_entidade: string }> }
    ).data;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]!.status).toBe('sugerida');
    expect(data[0]!.alvo_entidade).toBe(campanhaNome);
  });

  it('viewer NÃO aprova/aplica recomendação (403 por papel)', async () => {
    const lista = await request(app)
      .get(`/clientes/${clienteId}/recomendacoes`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    const id = (lista.body as { data: Array<{ id: string }> }).data[0]!.id;

    const res = await request(app)
      .patch(`/recomendacoes/${id}`)
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ status: 'aplicada' });
    expect(res.status).toBe(403);
  });

  it('DoD Do: aplicar recomendação de pausar PAUSA A CAMPANHA de verdade (provider + espelho + audit)', async () => {
    const lista = await request(app)
      .get(`/clientes/${clienteId}/recomendacoes`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    const alvo = (lista.body as { data: Array<{ id: string; tipo: string }> }).data.find(
      (r) => r.tipo === 'pausar_campanha',
    )!;
    expect(alvo).toBeDefined();

    const res = await request(app)
      .patch(`/recomendacoes/${alvo.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'aplicada' });
    expect(res.status).toBe(200);
    expect((res.body as { data: { status: string } }).data.status).toBe('aplicada');

    const { data: campRow } = await service
      .from('campanhas')
      .select('status, external_id')
      .eq('id', campanhaId)
      .single()
      .throwOnError();
    expect(campRow.status).toBe('pausada');

    const doProvider = await getProvider('demo').listarCampanhas(ACC);
    expect(doProvider.find((c) => c.externalId === campRow.external_id)?.status).toBe('pausada');

    const { data: audit } = await service
      .from('audit_log')
      .select('acao, depois')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'campanha')
      .eq('acao', 'operar');
    expect(audit?.some((a) => (a.depois as { status?: string })?.status === 'pausada')).toBe(true);
  }, 60_000);

  it('regras de otimização: criar, listar e desativar (gestor+)', async () => {
    const criar = await request(app)
      .post('/regras-otimizacao')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteId, nome: 'Guardrail CPA', condicao: { metrica: 'cpa' } });
    expect(criar.status).toBe(201);
    const regraId = (criar.body as { data: { id: string; ativo: boolean } }).data.id;
    expect((criar.body as { data: { ativo: boolean } }).data.ativo).toBe(true);

    const listar = await request(app)
      .get('/regras-otimizacao')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .query({ cliente_id: clienteId });
    expect(listar.status).toBe(200);
    expect((listar.body as { data: unknown[] }).data.length).toBeGreaterThan(0);

    const desativar = await request(app)
      .patch(`/regras-otimizacao/${regraId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ ativo: false });
    expect(desativar.status).toBe(200);
    expect((desativar.body as { data: { ativo: boolean } }).data.ativo).toBe(false);

    const viewerCriar = await request(app)
      .post('/regras-otimizacao')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ cliente_id: clienteId, nome: 'Bloqueada', condicao: {} });
    expect(viewerCriar.status).toBe(403);
  }, 60_000);
});
