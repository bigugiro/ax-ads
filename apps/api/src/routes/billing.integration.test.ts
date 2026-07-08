/**
 * Integração de Billing & onboarding (Sprint 9) — roda contra o Supabase
 * remoto. Não depende de chave Pagar.me: o `BillingProvider` `demo`
 * (placeholder, sem cobrança real) ativa a assinatura na hora. Prova o DoD:
 * "assinar e usar sem intervenção manual" — signup cria conta, agência,
 * usuário owner e assinatura numa chamada só, RLS e papéis respeitados.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Assinatura, Database, Papel } from '@ax-ads/shared';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodar = Boolean(url && anonKey && serviceKey);

const WEBHOOK_AUTH = `pagarme:${randomUUID()}`;

interface Tenant {
  agenciaId: string;
  token: string;
}

describe.skipIf(!podeRodar)('Billing & onboarding (Sprint 9): integração + RLS', () => {
  let app: Express;
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  const emailOwner = `t_${randomUUID()}@example.com`;
  const senhaOwner = `Pw_${randomUUID().slice(0, 12)}`;
  let agenciaOwnerId: string;
  let tokenOwner: string;

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
      .insert({ agencia_id: ag.id, nome: 'Teste', email, papel, auth_supabase_id: authData.user.id })
      .throwOnError();

    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.signInWithPassword({ email, password });
    return { agenciaId: ag.id, token: sess.session!.access_token };
  }

  beforeAll(async () => {
    process.env.PAGARME_WEBHOOK_AUTH = WEBHOOK_AUTH;
    const { createApp } = await import('../app');
    app = createApp();

    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } });
  }, 60_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
    delete process.env.PAGARME_WEBHOOK_AUTH;
  }, 60_000);

  it('DoD: signup cria conta, agência, usuário owner e assinatura numa chamada só', async () => {
    const res = await request(app).post('/auth/signup').send({
      nome_agencia: 'Agência Onboarding',
      nome: 'Dona da Loja',
      email: emailOwner,
      senha: senhaOwner,
      plano: 'pro',
    });
    expect(res.status).toBe(201);
    const corpo = (res.body as { data: { agenciaId: string; plano: string; status: string } }).data;
    expect(corpo.plano).toBe('pro');
    expect(corpo.status).toBe('ativa'); // demo ativa na hora, sem cobrança real
    agenciaOwnerId = corpo.agenciaId;
    agenciasCriadas.push(agenciaOwnerId);

    const { data: usuario } = await service
      .from('usuarios')
      .select('papel, auth_supabase_id')
      .eq('agencia_id', agenciaOwnerId)
      .eq('email', emailOwner)
      .single()
      .throwOnError();
    expect(usuario.papel).toBe('owner');
    authUsersCriados.push(usuario.auth_supabase_id);

    const { data: assinatura } = await service
      .from('assinaturas')
      .select('plano, status, pagarme_customer_id, pagarme_subscription_id')
      .eq('agencia_id', agenciaOwnerId)
      .single()
      .throwOnError();
    expect(assinatura.plano).toBe('pro');
    expect(assinatura.status).toBe('ativa');
    expect(assinatura.pagarme_customer_id).toMatch(/^demo_cus_/);
    expect(assinatura.pagarme_subscription_id).toMatch(/^demo_sub_/);
  }, 30_000);

  it('signup duplicado (mesmo e-mail) → 409, sem deixar conta órfã', async () => {
    const res = await request(app).post('/auth/signup').send({
      nome_agencia: 'Outra agência',
      nome: 'Outra pessoa',
      email: emailOwner,
      senha: 'OutraSenha123',
      plano: 'starter',
    });
    expect(res.status).toBe(409);
  }, 20_000);

  it('"usar sem intervenção manual": loga direto com o e-mail/senha do signup', async () => {
    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: emailOwner, password: senhaOwner });
    expect(error).toBeNull();
    tokenOwner = data.session!.access_token;
  });

  it('GET /assinatura devolve o plano e status corretos pro owner', async () => {
    const res = await request(app).get('/assinatura').set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: Assinatura }).data;
    expect(data.plano).toBe('pro');
    expect(data.status).toBe('ativa');
  });

  it('gestor da mesma agência NÃO troca de plano (403 por papel — só owner)', async () => {
    const gestor = await provisionarNaAgencia(agenciaOwnerId, 'gestor');
    const res = await request(app)
      .post('/billing/checkout')
      .set('Authorization', `Bearer ${gestor.token}`)
      .send({ plano: 'agency' });
    expect(res.status).toBe(403);
  });

  async function provisionarNaAgencia(agenciaId: string, papel: Papel): Promise<{ token: string }> {
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
      .insert({ agencia_id: agenciaId, nome: 'Membro', email, papel, auth_supabase_id: authData.user.id })
      .throwOnError();
    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.signInWithPassword({ email, password });
    return { token: sess.session!.access_token };
  }

  it('owner troca de plano (checkout) e agencias.plano fica em sincronia', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ plano: 'agency' });
    expect(res.status).toBe(201);
    expect((res.body as { data: Assinatura }).data.plano).toBe('agency');

    const { data: agencia } = await service
      .from('agencias')
      .select('plano')
      .eq('id', agenciaOwnerId)
      .single()
      .throwOnError();
    expect(agencia.plano).toBe('agency');
  });

  it('isolamento RLS: tenant B não enxerga a assinatura de A', async () => {
    const tenantB = await provisionar('Agência B — Billing', 'gestor');
    const res = await request(app).get('/assinatura').set('Authorization', `Bearer ${tenantB.token}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: unknown }).data).toBeNull();
  });

  it('owner cancela a assinatura', async () => {
    const res = await request(app)
      .post('/billing/cancelar')
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: Assinatura }).data.status).toBe('cancelada');
  });

  it('webhook: sem Basic Auth → 401; payload atualiza o status de verdade', async () => {
    const { data: assinatura } = await service
      .from('assinaturas')
      .select('pagarme_subscription_id')
      .eq('agencia_id', agenciaOwnerId)
      .single()
      .throwOnError();
    const subscriptionId = assinatura.pagarme_subscription_id!;

    const semAuth = await request(app)
      .post('/billing/webhook')
      .send({ pagarme_subscription_id: subscriptionId, status: 'ativa' });
    expect(semAuth.status).toBe(401);

    const comAuth = await request(app)
      .post('/billing/webhook')
      .auth('pagarme', WEBHOOK_AUTH.split(':')[1]!)
      .send({ pagarme_subscription_id: subscriptionId, status: 'ativa' });
    expect(comAuth.status).toBe(200);

    const { data: depois } = await service
      .from('assinaturas')
      .select('status')
      .eq('agencia_id', agenciaOwnerId)
      .single()
      .throwOnError();
    expect(depois.status).toBe('ativa');
  });

  // O caso "sem PAGARME_WEBHOOK_AUTH configurado → 503" é coberto no unit test
  // de `verificarBillingWebhookAuth` — `getEnv()` cacheia no 1º uso deste
  // processo de teste, então não dá pra alternar configurado/não-configurado
  // no mesmo arquivo de integração (mesma restrição do CRON_SECRET).
});
