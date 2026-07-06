/**
 * Integração + RLS do Sprint 4 (roda contra o Supabase remoto).
 * Prova o DoD: aplicar estratégia gera o checklist executável e mede o
 * resultado (baseline capturada), respeita papéis e o isolamento por agência.
 * Depende do catálogo semeado (0008_estrategias_seed.sql) já aplicado no banco.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database, Estrategia, EstrategiaAplicadaComContexto, Papel } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

interface Tenant {
  agenciaId: string;
  token: string;
}

describe.skipIf(!podeRodar)('estrategias — Sprint 4: integração + RLS', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let clienteA: string;
  let estrategiaFullFunnel: Estrategia;
  let aplicadaId: string;

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

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    gestorA = await provisionar('Agência A — estratégias', 'gestor');
    gestorB = await provisionar('Agência B — estratégias', 'gestor');
    viewerA = await provisionar('Agência C — estratégias (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Estratégias A' })
      .select('id')
      .single()
      .throwOnError();
    clienteA = cli.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('GET /estrategias exige token (401)', async () => {
    const res = await request(app).get('/estrategias');
    expect(res.status).toBe(401);
  });

  it('catálogo global: qualquer papel autenticado lê as 15 estratégias semeadas', async () => {
    const res = await request(app)
      .get('/estrategias')
      .set('Authorization', `Bearer ${viewerA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: Estrategia[] }).data;
    expect(data.length).toBeGreaterThanOrEqual(15);
    estrategiaFullFunnel = data.find((e) => e.slug === 'full-funnel-estrutura')!;
    expect(estrategiaFullFunnel).toBeDefined();
    expect(estrategiaFullFunnel.passos.length).toBeGreaterThan(0);
    expect(estrategiaFullFunnel.guardrails.length).toBeGreaterThan(0);
  });

  it('filtro por canal reduz a lista corretamente', async () => {
    const res = await request(app)
      .get('/estrategias?canal=google')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: Estrategia[] }).data;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => e.canal === 'google')).toBe(true);
  });

  it('GET /estrategias/:id retorna o detalhe', async () => {
    const res = await request(app)
      .get(`/estrategias/${estrategiaFullFunnel.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: Estrategia }).data.slug).toBe('full-funnel-estrutura');
  });

  it('viewer NÃO aplica estratégia (403 por papel)', async () => {
    const res = await request(app)
      .post(`/clientes/${clienteA}/estrategias/${estrategiaFullFunnel.id}/aplicar`)
      .set('Authorization', `Bearer ${viewerA.token}`);
    expect(res.status).toBe(403);
  });

  it('DoD: aplicar gera o checklist executável e mede o resultado (baseline)', async () => {
    const res = await request(app)
      .post(`/clientes/${clienteA}/estrategias/${estrategiaFullFunnel.id}/aplicar`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(201);

    const aplicada = (res.body as { data: EstrategiaAplicadaComContexto }).data;
    aplicadaId = aplicada.id;
    expect(aplicada.status).toBe('aplicada');
    expect(aplicada.aplicada_em).not.toBeNull();
    expect(aplicada.estrategia_versao).toBe(estrategiaFullFunnel.versao);

    // Checklist gerado 1:1 com os passos do catálogo.
    expect(aplicada.checklist.total).toBe(estrategiaFullFunnel.passos.length);
    expect(aplicada.checklist.feitos).toBe(0);
    expect(aplicada.checklist.itens).toHaveLength(estrategiaFullFunnel.passos.length);
    expect(aplicada.checklist.itens[0]?.descricao).toBe(estrategiaFullFunnel.passos[0]);
    expect(aplicada.checklist.itens.every((i) => !i.feito)).toBe(true);

    // Baseline de resultado capturada (Sprint 2 reaproveitado).
    const resultado = aplicada.resultado as { periodoBaseline: unknown; baseline: unknown };
    expect(resultado.periodoBaseline).toBeDefined();
    expect(resultado.baseline).toBeDefined();

    // Espelho real no banco.
    const { data: itensDb } = await service
      .from('estrategia_checklist_itens')
      .select('id')
      .eq('estrategia_aplicada_id', aplicadaId)
      .throwOnError();
    expect(itensDb).toHaveLength(estrategiaFullFunnel.passos.length);

    // Auditoria da aplicação.
    const { data: audit } = await service
      .from('audit_log')
      .select('acao')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'estrategia_aplicada')
      .eq('acao', 'aplicar');
    expect(audit?.length).toBeGreaterThan(0);
  }, 60_000);

  it('aplicar a mesma estratégia de novo no mesmo cliente responde 409', async () => {
    const res = await request(app)
      .post(`/clientes/${clienteA}/estrategias/${estrategiaFullFunnel.id}/aplicar`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(409);
  });

  it('GET /clientes/:id/estrategias-aplicadas lista com progresso e "atual" medido', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/estrategias-aplicadas`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: EstrategiaAplicadaComContexto[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(aplicadaId);
    expect(data[0]?.estrategia_titulo).toBe(estrategiaFullFunnel.titulo);
    expect(data[0]?.atual).not.toBeNull();
  });

  it('marcar item do checklist reflete no progresso', async () => {
    const listagem = await request(app)
      .get(`/clientes/${clienteA}/estrategias-aplicadas`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    const itemId = (listagem.body as { data: EstrategiaAplicadaComContexto[] }).data[0]!.checklist
      .itens[0]!.id;

    const patch = await request(app)
      .patch(`/estrategia-checklist/${itemId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ feito: true });
    expect(patch.status).toBe(200);
    expect((patch.body as { data: { feito: boolean } }).data.feito).toBe(true);

    const relistagem = await request(app)
      .get(`/clientes/${clienteA}/estrategias-aplicadas`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    const aplicada = (relistagem.body as { data: EstrategiaAplicadaComContexto[] }).data[0]!;
    expect(aplicada.checklist.feitos).toBe(1);
    expect(aplicada.checklist.itens.find((i) => i.id === itemId)?.feito).toBe(true);
  });

  it('mover status para pausada é auditado', async () => {
    const res = await request(app)
      .patch(`/estrategias-aplicadas/${aplicadaId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada' });
    expect(res.status).toBe(200);
    expect((res.body as { data: { status: string } }).data.status).toBe('pausada');

    const { data: audit } = await service
      .from('audit_log')
      .select('acao, depois')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'estrategia_aplicada')
      .eq('acao', 'atualizar');
    expect(audit?.some((a) => (a.depois as { status?: string })?.status === 'pausada')).toBe(true);
  });

  it('isolamento RLS: tenant B não enxerga aplicações de A (lista vazia, não erro)', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/estrategias-aplicadas`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('tenant B não move status nem marca checklist de A (404 via RLS)', async () => {
    const patchStatus = await request(app)
      .patch(`/estrategias-aplicadas/${aplicadaId}`)
      .set('Authorization', `Bearer ${gestorB.token}`)
      .send({ status: 'concluida' });
    expect(patchStatus.status).toBe(404);
  });

  it('catálogo global é somente leitura: authenticated não insere em estrategias', async () => {
    const anonComoGestorA = createClient<Database>(url!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${gestorA.token}` } },
      auth: { persistSession: false },
    });
    const { error } = await anonComoGestorA.from('estrategias').insert({
      slug: `hack-${randomUUID()}`,
      titulo: 'Tentativa de escrita',
      categoria: 'x',
      canal: 'ambos',
      objetivo: 'x',
      quando_usar: 'x',
      kpi_sucesso: 'x',
    });
    expect(error).not.toBeNull();
  });
});
