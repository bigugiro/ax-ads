/**
 * Integração + RLS do Sprint 5 (roda contra o Supabase remoto).
 * Prova o DoD: lead entra → automação dispara (e lead muda de estágio →
 * automação dispara), respeita papéis e o isolamento por agência.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type {
  Automacao,
  Database,
  EventoLead,
  LeadComEstagio,
  Papel,
  PipelineComEstagios,
} from '@ax-ads/shared';
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

describe.skipIf(!podeRodar)('CRM + automação — Sprint 5: integração + RLS', () => {
  const app = createApp();
  let service: SupabaseClient<Database>;
  const agenciasCriadas: string[] = [];
  const authUsersCriados: string[] = [];

  let gestorA: Tenant;
  let gestorB: Tenant;
  let viewerA: Tenant;
  let clienteA: string;
  let pipeline: PipelineComEstagios;

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
    gestorA = await provisionar('Agência A — CRM', 'gestor');
    gestorB = await provisionar('Agência B — CRM', 'gestor');
    viewerA = await provisionar('Agência C — CRM (viewer)', 'viewer');

    const { data: cli } = await service
      .from('clientes')
      .insert({ agencia_id: gestorA.agenciaId, nome: 'Loja CRM A' })
      .select('id')
      .single()
      .throwOnError();
    clienteA = cli.id;
  }, 120_000);

  afterAll(async () => {
    for (const id of agenciasCriadas) await service.from('agencias').delete().eq('id', id);
    for (const id of authUsersCriados) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it('GET /pipelines exige token (401)', async () => {
    const res = await request(app).get('/pipelines');
    expect(res.status).toBe(401);
  });

  it('viewer NÃO cria pipeline (403 por papel)', async () => {
    const res = await request(app)
      .post('/pipelines')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ cliente_id: clienteA, nome: 'Vendas' });
    expect(res.status).toBe(403);
  });

  it('gestor cria pipeline com os estágios padrão', async () => {
    const res = await request(app)
      .post('/pipelines')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, nome: 'Vendas' });
    expect(res.status).toBe(201);
    pipeline = (res.body as { data: PipelineComEstagios }).data;
    expect(pipeline.estagios).toHaveLength(6);
    expect(pipeline.estagios.map((e) => e.nome)).toEqual([
      'Novo',
      'Contatado',
      'Qualificado',
      'Proposta',
      'Ganho',
      'Perdido',
    ]);
  });

  it('GET /pipelines?cliente_id filtra corretamente', async () => {
    const res = await request(app)
      .get(`/pipelines?cliente_id=${clienteA}`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: PipelineComEstagios[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(pipeline.id);
  });

  it('cria a automação: lead de meta_ads entra → move pra Contatado', async () => {
    const res = await request(app)
      .post('/automacoes')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        nome: 'Boas-vindas Meta Ads',
        gatilho: 'lead_criado',
        condicoes: { origem: 'meta_ads' },
        acoes: [{ tipo: 'mudar_estagio', estagio_nome: 'Contatado' }],
      });
    expect(res.status).toBe(201);
    expect((res.body as { data: Automacao }).data.ativo).toBe(true);
  });

  it('DoD: lead que bate a condição (origem=meta_ads) dispara a automação', async () => {
    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const res = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        estagio_id: novoId,
        nome: 'Maria Compradora',
        contato: 'maria@example.com',
        origem: 'meta_ads',
      });
    expect(res.status).toBe(201);
    const lead = (res.body as { data: LeadComEstagio }).data;

    // A automação já rodou: o lead saiu de "Novo" e foi pra "Contatado".
    expect(lead.estagio_nome).toBe('Contatado');

    // Execução registrada (auditoria própria do motor de regras).
    const { data: execucoes } = await service
      .from('execucoes_automacao')
      .select('resultado')
      .eq('lead_id', lead.id)
      .throwOnError();
    expect(execucoes).toHaveLength(1);
    expect((execucoes[0]!.resultado as { acoesExecutadas: string[] }).acoesExecutadas).toEqual([
      'mudar_estagio',
    ]);
  }, 30_000);

  it('lead que NÃO bate a condição (origem diferente) não dispara a automação', async () => {
    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const res = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        estagio_id: novoId,
        nome: 'João Orgânico',
        contato: 'joao@example.com',
        origem: 'organico',
      });
    expect(res.status).toBe(201);
    const lead = (res.body as { data: LeadComEstagio }).data;
    expect(lead.estagio_nome).toBe('Novo');

    const { data: execucoes } = await service
      .from('execucoes_automacao')
      .select('id')
      .eq('lead_id', lead.id)
      .throwOnError();
    expect(execucoes).toHaveLength(0);
  });

  it('automação inativa não dispara', async () => {
    const criar = await request(app)
      .post('/automacoes')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        nome: 'Automação desligada',
        gatilho: 'lead_criado',
        condicoes: { origem: 'google_ads' },
        acoes: [{ tipo: 'definir_status', status: 'ganho' }],
      });
    const automacaoId = (criar.body as { data: Automacao }).data.id;

    const desligar = await request(app)
      .patch(`/automacoes/${automacaoId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ ativo: false });
    expect(desligar.status).toBe(200);
    expect((desligar.body as { data: Automacao }).data.ativo).toBe(false);

    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const lead = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        estagio_id: novoId,
        nome: 'Ana Google',
        contato: 'ana@example.com',
        origem: 'google_ads',
      });
    expect((lead.body as { data: LeadComEstagio }).data.status).toBe('aberto');
  });

  it('DoD: mudar de estágio dispara automação de lead_mudou_estagio (anota na linha do tempo)', async () => {
    await request(app)
      .post('/automacoes')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        nome: 'Avisa quando chega em Proposta',
        gatilho: 'lead_mudou_estagio',
        condicoes: { estagio_nome: 'Proposta' },
        acoes: [{ tipo: 'criar_evento', descricao: 'Lead chegou em Proposta' }],
      });

    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const propostaId = pipeline.estagios.find((e) => e.nome === 'Proposta')!.id;

    const criado = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({
        cliente_id: clienteA,
        estagio_id: novoId,
        nome: 'Carlos Proposta',
        contato: 'carlos@example.com',
        origem: 'indicacao',
      });
    const leadId = (criado.body as { data: LeadComEstagio }).data.id;

    const patch = await request(app)
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ estagio_id: propostaId });
    expect(patch.status).toBe(200);
    expect((patch.body as { data: LeadComEstagio }).data.estagio_nome).toBe('Proposta');

    const eventos = await request(app)
      .get(`/leads/${leadId}/eventos`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    expect(eventos.status).toBe(200);
    const dataEventos = (eventos.body as { data: EventoLead[] }).data;
    expect(dataEventos.some((e) => e.tipo === 'automacao')).toBe(true);
  }, 30_000);

  it('PATCH /leads/:id com body vazio → 422', async () => {
    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const criado = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({ cliente_id: clienteA, estagio_id: novoId, nome: 'X', contato: 'x@example.com' });
    const leadId = (criado.body as { data: LeadComEstagio }).data.id;

    const res = await request(app)
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${gestorA.token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('isolamento RLS: tenant B não enxerga leads/pipelines de A', async () => {
    const pipelinesB = await request(app)
      .get(`/pipelines?cliente_id=${clienteA}`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(pipelinesB.status).toBe(200);
    expect((pipelinesB.body as { data: unknown[] }).data).toHaveLength(0);

    const leadsB = await request(app)
      .get(`/leads?pipeline_id=${pipeline.id}`)
      .set('Authorization', `Bearer ${gestorB.token}`);
    expect(leadsB.status).toBe(200);
    expect((leadsB.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('tenant B não move lead de A (404 via RLS)', async () => {
    const leads = await request(app)
      .get(`/leads?pipeline_id=${pipeline.id}`)
      .set('Authorization', `Bearer ${gestorA.token}`);
    const algumLeadId = (leads.body as { data: LeadComEstagio[] }).data[0]!.id;

    const res = await request(app)
      .patch(`/leads/${algumLeadId}`)
      .set('Authorization', `Bearer ${gestorB.token}`)
      .send({ status: 'ganho' });
    expect(res.status).toBe(404);
  });

  it('viewer NÃO cria lead (403 por papel)', async () => {
    const novoId = pipeline.estagios.find((e) => e.nome === 'Novo')!.id;
    const res = await request(app)
      .post('/leads')
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ cliente_id: clienteA, estagio_id: novoId, nome: 'X', contato: 'x@example.com' });
    expect(res.status).toBe(403);
  });
});
