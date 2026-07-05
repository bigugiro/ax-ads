/**
 * Integração + RLS do Sprint 1 (roda contra o Supabase remoto).
 * Prova o DoD: conectar conta demo POPULA campanhas/conjuntos/anúncios/métricas
 * no banco, com isolamento entre tenants e checagem de papel.
 * Pula automaticamente se as variáveis do Supabase não estiverem no ambiente.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database, Papel } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

interface Tenant {
  agenciaId: string;
  usuarioId: string;
  token: string;
}

describe.skipIf(!podeRodar)('contas — integração + RLS (Sprint 1)', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let clienteA: string;
  let contaA: string;

  async function provisionar(nomeAgencia: string, papel: Papel): Promise<Tenant> {
    const { data: ag, error: agErr } = await service
      .from('agencias')
      .insert({ nome: nomeAgencia })
      .select('id')
      .single();
    if (agErr || !ag) throw agErr ?? new Error('agência não criada');
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

    const { data: u, error: uErr } = await service
      .from('usuarios')
      .insert({
        agencia_id: ag.id,
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

    return { agenciaId: ag.id, usuarioId: u.id, token: sess.session.access_token };
  }

  async function contarNaAgencia(
    tabela: 'contas_anuncio' | 'campanhas' | 'conjuntos' | 'anuncios' | 'metricas_diarias',
    agenciaId: string,
  ): Promise<number> {
    const { count, error } = await service
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('agencia_id', agenciaId);
    if (error) throw error;
    return count ?? 0;
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    gestorA = await provisionar('Agência A — contas', 'gestor');
    gestorB = await provisionar('Agência B — contas', 'gestor');
    viewerA = await provisionar('Agência C — contas', 'viewer');

    const { data: cli, error } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Demo A' })
      .select('id')
      .single();
    if (error || !cli) throw error ?? new Error('cliente não criado');
    clienteA = cli.id;
  }, 60_000);

  afterAll(async () => {
    // Cascade limpa clientes/contas/espelho/audit da agência.
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('rejeita requisição sem token (401)', async () => {
    const res = await request(app).get('/contas');
    expect(res.status).toBe(401);
  });

  it('lista contas demo disponíveis para conectar (gestor)', async () => {
    const res = await request(app)
      .get('/contas/disponiveis?plataforma=demo')
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const corpo = res.body as { data: Array<{ externalAccountId: string }> };
    expect(corpo.data.length).toBeGreaterThanOrEqual(3);
    expect(corpo.data.some((c) => c.externalAccountId === 'demo-acc-aurora')).toBe(true);
  });

  it('viewer NÃO pode conectar conta (403 por papel)', async () => {
    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'demo', external_account_id: 'demo-acc-aurora' });
    expect(res.status).toBe(403);
  });

  it('plataforma real ainda não plugada responde 501', async () => {
    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'meta', external_account_id: 'act_123' });
    expect(res.status).toBe(501);
  });

  it('conta inexistente na plataforma responde 404', async () => {
    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'demo', external_account_id: 'demo-acc-fake' });
    expect(res.status).toBe(404);
  });

  it('DoD: conectar conta demo popula campanhas/conjuntos/anúncios/métricas no banco', async () => {
    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'demo', external_account_id: 'demo-acc-aurora' });

    expect(res.status).toBe(201);
    const corpo = res.body as {
      data: { id: string; agencia_id: string; ultimo_sync_at: string | null };
      sync: { campanhas: number; conjuntos: number; anuncios: number; metricas: number };
    };
    contaA = corpo.data.id;
    expect(corpo.data.agencia_id).toBe(gestorA.agenciaId);
    expect(corpo.sync.campanhas).toBeGreaterThan(0);
    expect(corpo.sync.conjuntos).toBeGreaterThan(0);
    expect(corpo.sync.anuncios).toBeGreaterThan(0);
    expect(corpo.sync.metricas).toBeGreaterThan(0);

    // O banco reflete exatamente o resumo do sync.
    expect(await contarNaAgencia('campanhas', gestorA.agenciaId)).toBe(corpo.sync.campanhas);
    expect(await contarNaAgencia('conjuntos', gestorA.agenciaId)).toBe(corpo.sync.conjuntos);
    expect(await contarNaAgencia('anuncios', gestorA.agenciaId)).toBe(corpo.sync.anuncios);
    expect(await contarNaAgencia('metricas_diarias', gestorA.agenciaId)).toBe(corpo.sync.metricas);

    // Auditoria da conexão.
    const { data: audit } = await service
      .from('audit_log')
      .select('acao')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'conta_anuncio');
    expect(audit?.some((a) => a.acao === 'conectar')).toBe(true);
  }, 120_000);

  it('conectar a mesma conta duas vezes responde 409', async () => {
    const res = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, plataforma: 'demo', external_account_id: 'demo-acc-aurora' });
    expect(res.status).toBe(409);
  });

  it('isolamento RLS: tenant B não enxerga contas nem campanhas do tenant A', async () => {
    const lista = await request(app).get('/contas').set('Authorization', `Bearer ${gestorB.token}`);
    expect(lista.status).toBe(200);
    expect((lista.body as { data: unknown[] }).data).toHaveLength(0);

    // Direto no banco, com o JWT de B: espelho de A invisível.
    const anonB = createClient<Database>(url!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${gestorB.token}` } },
      auth: { persistSession: false },
    });
    const { data: campanhasB } = await anonB.from('campanhas').select('id');
    expect(campanhasB).toHaveLength(0);
    const { data: metricasB } = await anonB.from('metricas_diarias').select('id').limit(5);
    expect(metricasB).toHaveLength(0);
  });

  it('tenant B não sincroniza conta de A (404 via RLS)', async () => {
    const res = await request(app)
      .post(`/contas/${contaA}/sync`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(res.status).toBe(404);
  });

  it('re-sync é idempotente: mesmas contagens no espelho', async () => {
    const antes = await contarNaAgencia('metricas_diarias', gestorA.agenciaId);
    const res = await request(app)
      .post(`/contas/${contaA}/sync`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const corpo = res.body as { data: { ultimo_sync_at: string | null } };
    expect(corpo.data.ultimo_sync_at).not.toBeNull();

    const depois = await contarNaAgencia('metricas_diarias', gestorA.agenciaId);
    // Upsert por (entidade, data): re-sync não duplica linhas.
    expect(depois).toBe(antes);
  }, 120_000);

  it('pausar a conexão audita e bloqueia sync até reativar', async () => {
    const patch = await request(app)
      .patch(`/contas/${contaA}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'pausada' });
    expect(patch.status).toBe(200);

    const sync = await request(app)
      .post(`/contas/${contaA}/sync`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(sync.status).toBe(409);

    const reativa = await request(app)
      .patch(`/contas/${contaA}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ status: 'ativa' });
    expect(reativa.status).toBe(200);
  });

  it('desconectar remove a conta e o espelho inteiro (cascade)', async () => {
    const res = await request(app)
      .delete(`/contas/${contaA}`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(204);

    expect(await contarNaAgencia('contas_anuncio', gestorA.agenciaId)).toBe(0);
    expect(await contarNaAgencia('campanhas', gestorA.agenciaId)).toBe(0);
    expect(await contarNaAgencia('metricas_diarias', gestorA.agenciaId)).toBe(0);

    const { data: audit } = await service
      .from('audit_log')
      .select('acao')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('entidade', 'conta_anuncio');
    expect(audit?.some((a) => a.acao === 'desconectar')).toBe(true);
  });
});
