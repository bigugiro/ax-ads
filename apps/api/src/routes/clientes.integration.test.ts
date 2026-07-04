/**
 * Integração + RLS (roda contra o Supabase remoto).
 * Prova o requisito não-negociável: isolamento entre tenants e checagem de papel.
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
  authUserId: string;
  token: string;
  email: string;
  password: string;
}

describe.skipIf(!podeRodar)('clientes — integração + RLS', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;

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

    return {
      agenciaId: ag.id,
      usuarioId: u.id,
      authUserId: authData.user.id,
      token: sess.session.access_token,
      email,
      password,
    };
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    gestorA = await provisionar('Agência A', 'gestor');
    gestorB = await provisionar('Agência B', 'gestor');
    viewerA = await provisionar('Agência C', 'viewer');
  }, 60_000);

  afterAll(async () => {
    // Cascade remove usuarios/clientes/audit_log da agência.
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('rejeita requisição sem token (401)', async () => {
    const res = await request(app).get('/clientes');
    expect(res.status).toBe(401);
  });

  it('gestor cria cliente na própria agência (201) e audita', async () => {
    const res = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ nome: 'Loja A', site: 'https://loja-a.com' });

    expect(res.status).toBe(201);
    const criado = res.body as { data: { agencia_id: string } };
    expect(criado.data.agencia_id).toBe(gestorA.agenciaId);

    const { data: audit } = await service
      .from('audit_log')
      .select('acao, entidade')
      .eq('agencia_id', gestorA.agenciaId)
      .eq('acao', 'criar');
    expect(audit?.length).toBeGreaterThanOrEqual(1);
  });

  it('viewer NÃO pode criar cliente (403 por papel)', async () => {
    const res = await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ nome: 'Proibido' });
    expect(res.status).toBe(403);
  });

  it('isolamento RLS: tenant B não enxerga clientes do tenant A', async () => {
    // Garante um cliente em A.
    await request(app)
      .post('/clientes')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ nome: 'Somente A' });

    const listaB = await request(app)
      .get('/clientes')
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(listaB.status).toBe(200);
    const corpoB = listaB.body as { data: Array<{ nome: string; agencia_id: string }> };
    const nomesB = corpoB.data.map((c) => c.agencia_id);
    expect(nomesB.every((ag) => ag === gestorB.agenciaId)).toBe(true);
    expect(nomesB).not.toContain(gestorA.agenciaId);
  });

  it('viewer enxerga clientes da própria agência (leitura permitida)', async () => {
    const res = await request(app).get('/clientes').set('Authorization', `Bearer ${viewerA.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { data: unknown }).data)).toBe(true);
  });
});
