/**
 * Integração de Criativos visuais IA (Sprint 8) — roda contra o Supabase
 * remoto. Não depende de `ANTHROPIC_API_KEY`: o provider de imagem `demo`
 * (placeholder determinístico) não chama nenhuma API externa. Prova o DoD:
 * gera variações de verdade (persistidas), registra o log de custo (zero,
 * já que o placeholder não custa nada), respeita papéis e RLS.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { CriativoComVariacoes, Database, Papel } from '@ax-ads/shared';
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

describe.skipIf(!podeRodar)('Criativos visuais IA — Sprint 8: integração + RLS', () => {
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
    gestorA = await provisionar('Agência A — Imagem IA', 'gestor');
    gestorB = await provisionar('Agência B — Imagem IA', 'gestor');
    viewerA = await provisionar('Agência C — Imagem IA (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja Imagem IA A' })
      .select('id')
      .single()
      .throwOnError();
    clienteA = cli.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('POST /ia/imagem exige token (401)', async () => {
    const res = await request(app).post('/ia/imagem');
    expect(res.status).toBe(401);
  });

  it('viewer NÃO gera imagem (403 por papel)', async () => {
    const res = await request(app)
      .post('/ia/imagem')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ cliente_id: clienteA, produto: 'Tênis de corrida', quantidade: 1 });
    expect(res.status).toBe(403);
  });

  it('DoD: gera variações de imagem de verdade (determinísticas) e loga custo zero', async () => {
    const res = await request(app)
      .post('/ia/imagem')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        produto: 'Tênis de corrida leve',
        estilo: 'minimalista',
        quantidade: 3,
      });
    expect(res.status).toBe(201);

    const corpo = (res.body as { data: { criativo: CriativoComVariacoes; custo: number } }).data;
    expect(corpo.criativo.tipo).toBe('imagem');
    expect(corpo.criativo.variacoes).toHaveLength(3);
    for (const v of corpo.criativo.variacoes) {
      expect(v.conteudo).toMatch(/^data:image\/svg\+xml;base64,/);
    }
    // Cada variação é visualmente distinta (índices diferentes → cor/rótulo diferentes).
    const conteudos = new Set(corpo.criativo.variacoes.map((v) => v.conteudo));
    expect(conteudos.size).toBe(3);
    expect(corpo.custo).toBe(0);

    // Espelho real no banco.
    const { data: variacoesDb } = await service
      .from('variacoes_criativo')
      .select('conteudo')
      .eq('criativo_id', corpo.criativo.id);
    expect(variacoesDb).toHaveLength(3);

    // Log de custo (geracoes_ia) registrado com modelo='imagem', custo 0.
    const { data: geracao } = await service
      .from('geracoes_ia')
      .select('modelo, custo, tokens_in, tokens_out')
      .eq('cliente_id', clienteA)
      .eq('modelo', 'imagem')
      .single()
      .throwOnError();
    expect(geracao.custo).toBe(0);
    expect(geracao.tokens_in).toBe(0);
    expect(geracao.tokens_out).toBe(0);
  }, 30_000);

  it('gerar imagem repetindo o mesmo prompt é determinístico entre chamadas', async () => {
    const chamar = () =>
      request(app)
        .post('/ia/imagem')
        .set('Authorization', `Bearer ${gestorA.token}`)
        .send({ cliente_id: clienteA, produto: 'Produto fixo determinístico', quantidade: 1 });

    const a = await chamar();
    const b = await chamar();
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const urlA = (a.body as { data: { criativo: CriativoComVariacoes } }).data.criativo
      .variacoes[0]!.conteudo;
    const urlB = (b.body as { data: { criativo: CriativoComVariacoes } }).data.criativo
      .variacoes[0]!.conteudo;
    expect(urlA).toBe(urlB);
  });

  it('GET /clientes/:id/criativos?tipo=imagem lista só os criativos de imagem', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/criativos`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .query({ tipo: 'imagem' });
    expect(res.status).toBe(200);
    const data = (res.body as { data: CriativoComVariacoes[] }).data;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((c) => c.tipo === 'imagem')).toBe(true);
  });

  it('isolamento RLS: tenant B não enxerga criativos de imagem de A', async () => {
    const res = await request(app)
      .get(`/clientes/${clienteA}/criativos`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    // RLS: cliente de A não existe pra B → lista vazia, não erro.
    expect((res.body as { data: unknown[] }).data).toEqual([]);
  });
});
