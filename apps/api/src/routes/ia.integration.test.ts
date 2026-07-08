/**
 * Integração do Studio criativo IA (Sprint 6) — roda contra o Supabase remoto
 * E a API real da Anthropic (pula se `ANTHROPIC_API_KEY` não estiver no
 * ambiente). Prova o DoD: gera variações de verdade, registra o custo,
 * respeita papéis e o isolamento por agência.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type {
  ClassificacaoCriativo,
  CriativoComVariacoes,
  Database,
  GeracaoIA,
  Papel,
} from '@ax-ads/shared';
import { custoGeracao } from '@ax-ads/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const podeRodarSupabase = Boolean(url && anonKey && serviceKey);
const podeRodarAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
const podeRodar = podeRodarSupabase && podeRodarAnthropic;

interface Tenant {
  agenciaId: string;
  token: string;
}

describe.skipIf(!podeRodar)('Studio criativo IA — Sprint 6: integração real', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let clienteA: string;

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
    gestorA = await provisionar('Agência A — Studio IA', 'gestor');
    gestorB = await provisionar('Agência B — Studio IA', 'gestor');
    viewerA = await provisionar('Agência C — Studio IA (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Studio IA A' })
      .select('id')
      .single()
      .throwOnError();
    clienteA = cli.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('POST /ia/headlines exige token (401)', async () => {
    const res = await request(app).post('/ia/headlines');
    expect(res.status).toBe(401);
  });

  it('viewer NÃO gera criativo (403 por papel)', async () => {
    const res = await request(app)
      .post('/ia/headlines')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({
        cliente_id: clienteA,
        produto: 'Tênis de corrida',
        publico: 'Corredores amadores',
        quantidade: 1,
      });
    expect(res.status).toBe(403);
  });

  it('DoD: gera headlines de verdade via Sonnet e registra o custo', async () => {
    const res = await request(app)
      .post('/ia/headlines')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        produto: 'Tênis de corrida leve',
        publico: 'Corredores amadores de 25 a 40 anos',
        oferta: '15% off na primeira compra',
        quantidade: 1,
      });
    expect(res.status).toBe(201);

    const corpo = (res.body as { data: { criativo: CriativoComVariacoes; custo: number } }).data;
    expect(corpo.criativo.tipo).toBe('headline');
    expect(corpo.criativo.variacoes.length).toBeGreaterThanOrEqual(1);
    expect(corpo.criativo.variacoes[0]!.conteudo.length).toBeGreaterThan(0);
    expect(corpo.custo).toBeGreaterThan(0);

    // Espelho real no banco.
    const { data: variacoesDb } = await service
      .from('variacoes_criativo')
      .select('conteudo')
      .eq('criativo_id', corpo.criativo.id)
      .throwOnError();
    expect(variacoesDb.length).toBe(corpo.criativo.variacoes.length);

    // Log de custo bate com a fórmula pura (mesmos tokens → mesmo custo).
    const { data: geracoes } = await service
      .from('geracoes_ia')
      .select('modelo, tokens_in, tokens_out, custo')
      .eq('cliente_id', clienteA)
      .eq('modelo', 'sonnet')
      .throwOnError();
    const geracao = geracoes.at(-1)!;
    expect(geracao.tokens_in).toBeGreaterThan(0);
    expect(geracao.tokens_out).toBeGreaterThan(0);
    expect(Number(geracao.custo)).toBeCloseTo(
      custoGeracao('sonnet', geracao.tokens_in, geracao.tokens_out),
      6,
    );
  }, 60_000);

  it('DoD: classifica um criativo de verdade via Haiku e registra o custo', async () => {
    const res = await request(app)
      .post('/ia/analise')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        texto: 'Só hoje: tênis de corrida com 15% off e frete grátis. Compre agora.',
      });
    expect(res.status).toBe(201);

    const corpo = (res.body as { data: { classificacao: ClassificacaoCriativo; custo: number } })
      .data;
    expect(corpo.classificacao.angulo).toMatch(/^(dor|desejo|prova_social|oferta|curiosidade)$/);
    expect(corpo.classificacao.forca_cta).toBeGreaterThanOrEqual(1);
    expect(corpo.classificacao.forca_cta).toBeLessThanOrEqual(5);
    expect(corpo.custo).toBeGreaterThan(0);

    const { data: geracoes } = await service
      .from('geracoes_ia')
      .select('modelo, tokens_in, tokens_out')
      .eq('cliente_id', clienteA)
      .eq('modelo', 'haiku')
      .throwOnError();
    expect(geracoes.length).toBeGreaterThan(0);
    expect(geracoes.at(-1)!.tokens_in).toBeGreaterThan(0);
  }, 60_000);

  it('GET /clientes/:id/geracoes-ia lista o log de custo do cliente', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/geracoes-ia`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: GeracaoIA[] }).data;
    expect(data.length).toBeGreaterThanOrEqual(2); // sonnet + haiku dos testes acima
  });

  it('isolamento RLS: tenant B não enxerga criativos/gerações de A', async () => {
    const criativos = await request(app)
      .get(`/clientes/${clienteA}/criativos`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(criativos.status).toBe(200);
    expect((criativos.body as { data: unknown[] }).data).toHaveLength(0);

    const geracoes = await request(app)
      .get(`/clientes/${clienteA}/geracoes-ia`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(geracoes.status).toBe(200);
    expect((geracoes.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('payload inválido → 422', async () => {
    const res = await request(app)
      .post('/ia/copy')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA }); // sem produto/publico
    expect(res.status).toBe(422);
  });
});
