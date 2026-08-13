/**
 * Integração de agência (Sprint 10): `GET /me`, white-label básico
 * (`PATCH /agencias/marca`) e exclusão de conta / LGPD
 * (`DELETE /agencias/me`). Roda contra o Supabase remoto.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Agencia, Database, Papel, Usuario } from '@ax-ads/shared';
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

describe.skipIf(!podeRodar)('Agência — marca e exclusão (Sprint 10): integração + RLS', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let owner: Tenant;
  let gestor: Tenant;

  async function provisionar(nome: string, papel: Papel, agenciaId?: string): Promise<Tenant> {
    let agId = agenciaId;
    if (!agId) {
      const { data: ag } = await service
        .from('agencias')
        .insert({ nome })
        .select('id')
        .single()
        .throwOnError();
      agId = ag.id;
      agenciasCriadas.push(agId);
    }

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
      .insert({ agencia_id: agId, nome: 'Teste', email, papel, auth_supabase_id: authData.user.id })
      .throwOnError();

    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.signInWithPassword({ email, password });
    return { agenciaId: agId, token: sess.session!.access_token };
  }

  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
    owner = await provisionar('Agência A — marca/exclusão', 'owner');
    gestor = await provisionar('Agência A — marca/exclusão', 'gestor', owner.agenciaId);
  }, 60_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('GET /me exige token (401)', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('GET /me devolve usuário + agência (sem marca ainda)', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const data = res.body as { data: { usuario: Usuario; agencia: Agencia } };
    expect(data.data.usuario.papel).toBe('owner');
    expect(data.data.usuario.super_admin).toBe(false);
    expect(data.data.agencia.id).toBe(owner.agenciaId);
    expect(data.data.agencia.marca_nome).toBeNull();
  });

  it('gestor NÃO edita a marca (403 por papel — só owner)', async () => {
    const res = await request(app)
      .patch('/agencias/marca')
      .set('Authorization', `Bearer ${gestor.token}`)
      .send({ marca_nome: 'Loja X' });
    expect(res.status).toBe(403);
  });

  it('DoD white-label: owner edita nome/cor/logo e GET /me reflete', async () => {
    const res = await request(app)
      .patch('/agencias/marca')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        marca_nome: 'Painel da Loja X',
        marca_cor: '#112233',
        marca_logo_url: 'https://ex.com/logo.png',
      });
    expect(res.status).toBe(200);
    const data = (res.body as { data: Agencia }).data;
    expect(data.marca_nome).toBe('Painel da Loja X');
    expect(data.marca_cor).toBe('#112233');
    expect(data.marca_logo_url).toBe('https://ex.com/logo.png');

    const depois = await request(app).get('/me').set('Authorization', `Bearer ${owner.token}`);
    expect((depois.body as { data: { agencia: Agencia } }).data.agencia.marca_nome).toBe(
      'Painel da Loja X',
    );
  });

  it('cor fora do formato hex → 422', async () => {
    const res = await request(app)
      .patch('/agencias/marca')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ marca_cor: 'laranja' });
    expect(res.status).toBe(422);
  });

  it('gestor NÃO exclui a conta (403 por papel — só owner)', async () => {
    const res = await request(app)
      .delete('/agencias/me')
      .set('Authorization', `Bearer ${gestor.token}`);
    expect(res.status).toBe(403);
  });

  it('DoD LGPD: owner exclui a conta — agência e usuários somem de verdade', async () => {
    const res = await request(app)
      .delete('/agencias/me')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(204);

    const { data: agenciaDepois } = await service
      .from('agencias')
      .select('id')
      .eq('id', owner.agenciaId)
      .maybeSingle();
    expect(agenciaDepois).toBeNull();

    const { data: usuariosDepois } = await service
      .from('usuarios')
      .select('id')
      .eq('agencia_id', owner.agenciaId);
    expect(usuariosDepois).toEqual([]);

    // Já foi apagada pelo próprio teste — não deixa o afterAll tentar de novo.
    agenciasCriadas.splice(agenciasCriadas.indexOf(owner.agenciaId), 1);
  }, 30_000);
});
