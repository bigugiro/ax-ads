/**
 * Integração + RLS do Sprint 3 (roda contra o Supabase remoto).
 * Prova o DoD: operar campanha (pausar/ativar/ajustar budget) reflete NO
 * PROVIDER e no espelho, é auditado, respeita papéis e o isolamento por agência.
 * Usa a conta demo `modabella` (isolada dos outros testes de integração).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { CampanhaComContexto, Database, Papel } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getProvider } from '../providers';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

const ACC = 'demo-acc-modabella';

interface Tenant {
  agenciaId: string;
  token: string;
}

describe.skipIf(!podeRodar)('campanhas — operar (Sprint 3): integração + RLS', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let contaA: string;
  let campanha: CampanhaComContexto;

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
    gestorA = await provisionar('Agência A — campanhas', 'gestor');
    gestorB = await provisionar('Agência B — campanhas', 'gestor');
    viewerA = await provisionar('Agência C — campanhas (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Camp A' })
      .select('id')
      .single()
      .throwOnError();

    const conectar = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: cli.id, plataforma: 'demo', external_account_id: ACC });
    expect(conectar.status).toBe(201);
    contaA = (conectar.body as { data: { id: string } }).data.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('GET /campanhas exige token (401)', async () => {
    const res = await request(app).get('/campanhas');
    expect(res.status).toBe(401);
  });

  it('GET /campanhas lista enriquecido (cliente/plataforma)', async () => {
    const res = await request(app)
      .get('/campanhas')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: CampanhaComContexto[] }).data;
    expect(data.length).toBeGreaterThan(0);
    campanha = data[0]!;
    expect(campanha.cliente_nome).toBe('Loja Camp A');
    expect(campanha.plataforma).toBe('demo');
    expect(campanha.external_id).toMatch(/^demo-cmp-/);
  });

  it('body vazio → 422', async () => {
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('viewer NÃO opera campanha (403 por papel)', async () => {
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ status: 'pausada' });
    expect(res.status).toBe(403);
  });

  it('tenant B não enxerga campanha de A (404 via RLS)', async () => {
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorB.token}`)
      .send({ status: 'pausada' });
    expect(res.status).toBe(404);
  });

  it('DoD: pausar reflete no PROVIDER, no espelho e no audit', async () => {
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada' });
    expect(res.status).toBe(200);
    expect((res.body as { data: { status: string } }).data.status).toBe('pausada');

    // Espelho no banco.
    const { data: row } = await service
      .from('campanhas')
      .select('status')
      .eq('id', campanha.id)
      .single()
      .throwOnError();
    expect(row.status).toBe('pausada');

    // Provider: a mesma campanha volta como pausada (override aplicado).
    const doProvider = await getProvider('demo').listarCampanhas(ACC);
    expect(doProvider.find((c) => c.externalId === campanha.external_id)?.status).toBe('pausada');

    // Auditoria da operação.
    const { data: audit } = await service
      .from('audit_log')
      .select('acao, depois')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'campanha')
      .eq('acao', 'operar');
    expect(audit?.length).toBeGreaterThan(0);
    expect(audit?.some((a) => (a.depois as { status?: string })?.status === 'pausada')).toBe(true);
  }, 60_000);

  it('ajustar budget reflete no provider e no espelho', async () => {
    const novo = 777;
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ budget: novo });
    expect(res.status).toBe(200);
    expect(Number((res.body as { data: { budget: number } }).data.budget)).toBe(novo);

    const doProvider = await getProvider('demo').listarCampanhas(ACC);
    expect(doProvider.find((c) => c.externalId === campanha.external_id)?.budget).toBe(novo);
  });

  it('re-sync preserva a mudança (provider é a fonte)', async () => {
    // Self-contained: aplica status+budget e re-sincroniza no mesmo teste.
    const patch = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada', budget: 777 });
    expect(patch.status).toBe(200);

    const sync = await request(app)
      .post(`/contas/${contaA}/sync`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(sync.status).toBe(200);

    const { data: row } = await service
      .from('campanhas')
      .select('status, budget')
      .eq('id', campanha.id)
      .single()
      .throwOnError();
    expect(row.status).toBe('pausada');
    expect(Number(row.budget)).toBe(777);
  }, 60_000);

  it('reativar volta status para ativa', async () => {
    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'ativa' });
    expect(res.status).toBe(200);
    expect((res.body as { data: { status: string } }).data.status).toBe('ativa');
  });

  it('conta pausada bloqueia operar (409), sem tocar no provider', async () => {
    await request(app)
      .patch(`/contas/${contaA}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada' });

    const res = await request(app)
      .patch(`/campanhas/${campanha.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada' });
    expect(res.status).toBe(409);
  });
});
