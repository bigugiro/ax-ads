/**
 * Integração do admin mínimo (Sprint 10) — cross-tenant, atrás de
 * `requireSuperAdmin`. `super_admin` nunca é setável via API (por design);
 * o teste seta via service role, simulando o operador rodando SQL direto.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { AgenciaAdmin, Database, Papel } from '@ax-ads/shared';
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

describe.skipIf(!podeRodar)('Admin (Sprint 10): cross-tenant, integração', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let comum: Tenant;
  let admin: Tenant;
  let agenciaAlvo: string;

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
    comum = await provisionar('Agência — usuário comum', 'owner');
    admin = await provisionar('Agência — operador SaaS', 'owner');
    agenciaAlvo = await provisionarAgenciaAlvo();

    // Promove a `admin` a super_admin — só possível via SQL direto (service role).
    await service
      .from('usuarios')
      .update({ super_admin: true })
      .eq('agencia_id', admin.agenciaId)
      .throwOnError();
  }, 60_000);

  async function provisionarAgenciaAlvo(): Promise<string> {
    const { data: ag } = await service
      .from('agencias')
      .insert({ nome: 'Agência — alvo do admin' })
      .select('id')
      .single()
      .throwOnError();
    agenciasCriadas.push(ag.id);
    return ag.id;
  }

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('usuário comum NÃO acessa /admin/agencias (403 — não é super_admin)', async () => {
    const res = await request(app)
      .get('/admin/agencias')
      .set('Authorization', `Bearer ${comum.token}`);
    expect(res.status).toBe(403);
  });

  it('DoD admin: super_admin lista TODAS as agências (cross-tenant, não só a própria)', async () => {
    const res = await request(app)
      .get('/admin/agencias')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: AgenciaAdmin[] }).data;
    expect(data.some((a) => a.id === comum.agenciaId)).toBe(true);
    expect(data.some((a) => a.id === agenciaAlvo)).toBe(true);
  });

  it('super_admin suspende e reativa uma agência que não é a própria', async () => {
    const suspender = await request(app)
      .patch(`/admin/agencias/${agenciaAlvo}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'suspenso' });
    expect(suspender.status).toBe(200);
    expect((suspender.body as { data: AgenciaAdmin }).data.status).toBe('suspenso');

    const { data: row } = await service
      .from('agencias')
      .select('status')
      .eq('id', agenciaAlvo)
      .single();
    expect(row?.status).toBe('suspenso');

    const reativar = await request(app)
      .patch(`/admin/agencias/${agenciaAlvo}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'ativo' });
    expect(reativar.status).toBe(200);
    expect((reativar.body as { data: AgenciaAdmin }).data.status).toBe('ativo');
  });
});
