/**
 * Integração do cron de sync (Sprint 2). Prova a autorização por CRON_SECRET e
 * que o job re-materializa o espelho das contas ativas (service role, sem JWT).
 * Define CRON_SECRET no ambiente ANTES de criar o app (getEnv cacheia no 1º uso).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@ax-ads/shared';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

const SECRET = `cron_${randomUUID()}`;

interface ResultadoCron {
  total: number;
  ok: number;
  falhas: number;
  contas: Array<{ contaId: string; ok: boolean; resumo?: { metricas: number } }>;
}

describe.skipIf(!podeRodar)('cron /sync-metricas — integração (Sprint 2)', () => {
  let app: Express;
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];
  let token: string;
  let contaId: string;

  beforeAll(async () => {
    // Segredo do cron precisa existir antes do primeiro getEnv (dentro do createApp).
    process.env.CRON_SECRET = SECRET;
    const { createApp } = await import('../app');
    app = createApp();

    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });

    const { data: ag } = await service
      .from('agencias')
      .insert({ nome: 'Agência — cron' })
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
        papel: 'gestor',
        auth_supabase_id: authData.user.id,
      })
      .throwOnError();

    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.signInWithPassword({ email, password });
    token = sess.session!.access_token;

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: ag.id, nome: 'Loja Cron' })
      .select('id')
      .single()
      .throwOnError();

    const conectar = await request(app)
      .post('/contas')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: cli.id, plataforma: 'demo', external_account_id: 'demo-acc-techshop' });
    expect(conectar.status).toBe(201);
    contaId = (conectar.body as { data: { id: string } }).data.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
    delete process.env.CRON_SECRET;
  }, 60_000);

  it('sem segredo → 401', async () => {
    const res = await request(app).post('/cron/sync-metricas');
    expect(res.status).toBe(401);
  });

  it('segredo errado → 401', async () => {
    const res = await request(app)
      .post('/cron/sync-metricas')
      .set('Authorization', 'Bearer errado');
    expect(res.status).toBe(401);
  });

  it('segredo válido → 200 e sincroniza a conta ativa', async () => {
    // Zera o carimbo para provar que o cron o atualiza.
    await service
      .from('contas_anuncio')
      .update({ ultimo_sync_at: null })
      .eq('id', contaId)
      .throwOnError();

    const res = await request(app)
      .post('/cron/sync-metricas')
      .set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);

    const resultado = (res.body as { data: ResultadoCron }).data;
    expect(resultado.total).toBeGreaterThanOrEqual(1);
    const minha = resultado.contas.find((c) => c.contaId === contaId);
    expect(minha?.ok).toBe(true);
    expect(minha?.resumo?.metricas).toBeGreaterThan(0);

    const { data: conta } = await service
      .from('contas_anuncio')
      .select('ultimo_sync_at')
      .eq('id', contaId)
      .single()
      .throwOnError();
    expect(conta.ultimo_sync_at).not.toBeNull();
  }, 120_000);

  it('conta pausada não é sincronizada pelo cron', async () => {
    await service
      .from('contas_anuncio')
      .update({ status: 'pausada', ultimo_sync_at: null })
      .eq('id', contaId)
      .throwOnError();

    const res = await request(app)
      .post('/cron/sync-metricas')
      .set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const resultado = (res.body as { data: ResultadoCron }).data;
    expect(resultado.contas.find((c) => c.contaId === contaId)).toBeUndefined();

    const { data: conta } = await service
      .from('contas_anuncio')
      .select('ultimo_sync_at')
      .eq('id', contaId)
      .single()
      .throwOnError();
    expect(conta.ultimo_sync_at).toBeNull(); // não tocada
  }, 60_000);
});
