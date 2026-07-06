/**
 * Serviço de CRM + automação (Sprint 5, Seção 5 do plano): pipelines/estágios,
 * leads, linha do tempo e o motor de execução de automações.
 *
 * O motor roda SEMPRE com o client do usuário que originou o evento (RLS
 * aplicada normalmente — nenhuma automação escapa do isolamento por agência).
 * Ações disparadas por uma automação NÃO reacionam outras automações (guarda
 * simples contra loop infinito): só o evento original do usuário dispara.
 */
import {
  condicoesBatem,
  ESTAGIOS_PADRAO,
  type AcaoAutomacao,
  type AtualizarAutomacao,
  type AtualizarLead,
  type Automacao,
  type CriarAutomacao,
  type CriarLead,
  type CriarPipeline,
  type Estagio,
  type Json,
  type Lead,
  type LeadComEstagio,
  type ListarAutomacoesQuery,
  type ListarLeadsQuery,
  type ListarPipelinesQuery,
  type PipelineComEstagios,
  type ResultadoExecucaoAutomacao,
} from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';

// ----- Pipelines / Estágios -----

export async function criarPipeline(
  db: DbClient,
  params: { agenciaId: string; payload: CriarPipeline },
): Promise<PipelineComEstagios> {
  const { agenciaId, payload } = params;

  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', payload.cliente_id)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  const { data: pipeline, error } = await db
    .from('pipelines')
    .insert({ agencia_id: agenciaId, cliente_id: payload.cliente_id, nome: payload.nome })
    .select('*')
    .single();
  if (error || !pipeline) throw new HttpError(500, 'Falha ao criar pipeline', error?.message);

  const nomesEstagios = payload.estagios ?? ESTAGIOS_PADRAO;
  const { data: estagios, error: estErr } = await db
    .from('estagios')
    .insert(
      nomesEstagios.map((nome, i) => ({
        agencia_id: agenciaId,
        pipeline_id: pipeline.id,
        nome,
        ordem: i,
      })),
    )
    .select('*')
    .order('ordem');
  if (estErr) throw new HttpError(500, 'Falha ao criar estágios', estErr.message);

  return { ...pipeline, estagios: estagios };
}

export async function listarPipelines(
  db: DbClient,
  filtros: ListarPipelinesQuery,
): Promise<PipelineComEstagios[]> {
  let query = db.from('pipelines').select('*').order('created_at', { ascending: false });
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  const { data: pipelines, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar pipelines', error.message);
  if (pipelines.length === 0) return [];

  const { data: estagios, error: estErr } = await db
    .from('estagios')
    .select('*')
    .in(
      'pipeline_id',
      pipelines.map((p) => p.id),
    )
    .order('ordem');
  if (estErr) throw new HttpError(500, 'Falha ao carregar estágios', estErr.message);

  return pipelines.map((p) => ({
    ...p,
    estagios: (estagios as Estagio[]).filter((e) => e.pipeline_id === p.id),
  }));
}

// ----- Leads -----

export async function listarLeads(
  db: DbClient,
  filtros: ListarLeadsQuery,
): Promise<LeadComEstagio[]> {
  let estagioIds: string[] | undefined;
  if (filtros.pipeline_id) {
    const { data: estagios, error } = await db
      .from('estagios')
      .select('id')
      .eq('pipeline_id', filtros.pipeline_id);
    if (error) throw new HttpError(500, 'Falha ao carregar estágios', error.message);
    estagioIds = estagios.map((e) => e.id);
    if (estagioIds.length === 0) return [];
  }

  let query = db.from('leads').select('*').order('created_at', { ascending: false });
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  if (estagioIds) query = query.in('estagio_id', estagioIds);
  const { data: leads, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar leads', error.message);
  if (leads.length === 0) return [];

  const { data: todosEstagios, error: estErr } = await db
    .from('estagios')
    .select('id, nome')
    .in('id', [...new Set(leads.map((l) => l.estagio_id))]);
  if (estErr) throw new HttpError(500, 'Falha ao carregar estágios', estErr.message);
  const nomePorEstagio = new Map(todosEstagios.map((e) => [e.id, e.nome]));

  return leads.map((l) => ({ ...l, estagio_nome: nomePorEstagio.get(l.estagio_id) ?? '—' }));
}

async function buscarEstagio(db: DbClient, id: string): Promise<Estagio> {
  const { data, error } = await db.from('estagios').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao carregar estágio', error.message);
  if (!data) throw new HttpError(404, 'Estágio não encontrado');
  return data;
}

export async function criarLead(
  db: DbClient,
  params: { agenciaId: string; payload: CriarLead },
): Promise<LeadComEstagio> {
  const { agenciaId, payload } = params;

  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', payload.cliente_id)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  await buscarEstagio(db, payload.estagio_id); // valida que o estágio existe (404 se não)

  const { data: lead, error } = await db
    .from('leads')
    .insert({
      agencia_id: agenciaId,
      cliente_id: payload.cliente_id,
      estagio_id: payload.estagio_id,
      nome: payload.nome,
      contato: payload.contato,
      origem: payload.origem,
      valor: payload.valor ?? null,
    })
    .select('*')
    .single();
  if (error || !lead) throw new HttpError(500, 'Falha ao criar lead', error?.message);

  await dispararAutomacoes(db, {
    agenciaId,
    clienteId: payload.cliente_id,
    leadId: lead.id,
    gatilho: 'lead_criado',
    contexto: { origem: lead.origem },
  });

  // Recarrega: o próprio lead pode ter sido alterado por uma automação (ex.: mudar_estagio).
  const leadAtual = await buscarLead(db, lead.id);
  return leadAtual;
}

async function buscarLead(db: DbClient, id: string): Promise<LeadComEstagio> {
  const { data: lead, error } = await db.from('leads').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao carregar lead', error.message);
  if (!lead) throw new HttpError(404, 'Lead não encontrado');
  const estagio = await buscarEstagio(db, lead.estagio_id);
  return { ...lead, estagio_nome: estagio.nome };
}

export async function atualizarLead(
  db: DbClient,
  params: { agenciaId: string; id: string; patch: AtualizarLead },
): Promise<LeadComEstagio> {
  const { agenciaId, id, patch } = params;

  const { data: antes, error: antesErr } = await db
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (antesErr) throw new HttpError(500, 'Falha ao carregar lead', antesErr.message);
  if (!antes) throw new HttpError(404, 'Lead não encontrado');

  let novoEstagio: Estagio | null = null;
  if (patch.estagio_id !== undefined && patch.estagio_id !== antes.estagio_id) {
    novoEstagio = await buscarEstagio(db, patch.estagio_id);
  }

  // Só inclui as chaves realmente enviadas (exactOptionalPropertyTypes + evita
  // sobrescrever colunas com `undefined` no PATCH parcial).
  const mudancas: Partial<Lead> = {};
  if (patch.estagio_id !== undefined) mudancas.estagio_id = patch.estagio_id;
  if (patch.nome !== undefined) mudancas.nome = patch.nome;
  if (patch.contato !== undefined) mudancas.contato = patch.contato;
  if (patch.valor !== undefined) mudancas.valor = patch.valor;
  if (patch.status !== undefined) mudancas.status = patch.status;

  const { data: depois, error } = await db
    .from('leads')
    .update(mudancas)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !depois) throw new HttpError(500, 'Falha ao atualizar lead', error?.message);

  if (novoEstagio) {
    await dispararAutomacoes(db, {
      agenciaId,
      clienteId: depois.cliente_id,
      leadId: depois.id,
      gatilho: 'lead_mudou_estagio',
      contexto: { origem: depois.origem, estagioNome: novoEstagio.nome },
    });
  }

  return buscarLead(db, id);
}

// ----- Linha do tempo (eventos_lead) -----

export async function criarEventoLead(
  db: DbClient,
  params: { agenciaId: string; leadId: string; tipo: string; payload?: Record<string, unknown> },
): Promise<void> {
  const { error } = await db.from('eventos_lead').insert({
    agencia_id: params.agenciaId,
    lead_id: params.leadId,
    tipo: params.tipo,
    payload: (params.payload ?? {}) as Json,
  });
  if (error) throw new HttpError(500, 'Falha ao registrar evento', error.message);
}

export async function listarEventosLead(db: DbClient, leadId: string) {
  const { data, error } = await db
    .from('eventos_lead')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar eventos', error.message);
  return data;
}

// ----- Automações -----

export async function listarAutomacoes(
  db: DbClient,
  filtros: ListarAutomacoesQuery,
): Promise<Automacao[]> {
  let query = db.from('automacoes').select('*').order('created_at', { ascending: false });
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar automações', error.message);
  return data as Automacao[];
}

export async function criarAutomacao(
  db: DbClient,
  params: { agenciaId: string; payload: CriarAutomacao },
): Promise<Automacao> {
  const { agenciaId, payload } = params;
  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', payload.cliente_id)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  const { data, error } = await db
    .from('automacoes')
    .insert({
      agencia_id: agenciaId,
      cliente_id: payload.cliente_id,
      nome: payload.nome,
      gatilho: payload.gatilho,
      condicoes: payload.condicoes,
      acoes: payload.acoes,
    })
    .select('*')
    .single();
  if (error || !data) throw new HttpError(500, 'Falha ao criar automação', error?.message);
  return data as Automacao;
}

export async function atualizarAutomacao(
  db: DbClient,
  id: string,
  patch: AtualizarAutomacao,
): Promise<Automacao> {
  const mudancas: Partial<Pick<Automacao, 'nome' | 'condicoes' | 'acoes' | 'ativo'>> = {};
  if (patch.nome !== undefined) mudancas.nome = patch.nome;
  if (patch.condicoes !== undefined) mudancas.condicoes = patch.condicoes;
  if (patch.acoes !== undefined) mudancas.acoes = patch.acoes;
  if (patch.ativo !== undefined) mudancas.ativo = patch.ativo;

  const { data, error } = await db
    .from('automacoes')
    .update(mudancas)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao atualizar automação', error.message);
  if (!data) throw new HttpError(404, 'Automação não encontrada');
  return data as Automacao;
}

// ----- Motor de execução -----

async function executarAcoes(
  db: DbClient,
  params: { agenciaId: string; leadId: string; automacaoNome: string; acoes: AcaoAutomacao[] },
): Promise<ResultadoExecucaoAutomacao> {
  const { agenciaId, leadId, automacaoNome, acoes } = params;
  const acoesExecutadas: AcaoAutomacao['tipo'][] = [];
  let erro: string | undefined;

  for (const acao of acoes) {
    try {
      switch (acao.tipo) {
        case 'mudar_estagio': {
          const { data: leadAtual, error: leadErr } = await db
            .from('leads')
            .select('estagio_id')
            .eq('id', leadId)
            .maybeSingle();
          if (leadErr || !leadAtual) throw new Error('lead não encontrado');
          const { data: estagioAtual, error: estErr } = await db
            .from('estagios')
            .select('pipeline_id')
            .eq('id', leadAtual.estagio_id)
            .maybeSingle();
          if (estErr || !estagioAtual) throw new Error('estágio atual não encontrado');
          const { data: destino, error: destErr } = await db
            .from('estagios')
            .select('id')
            .eq('pipeline_id', estagioAtual.pipeline_id)
            .eq('nome', acao.estagio_nome)
            .maybeSingle();
          if (destErr) throw new Error(destErr.message);
          if (!destino) throw new Error(`estágio "${acao.estagio_nome}" não existe no pipeline`);
          const { error: updErr } = await db
            .from('leads')
            .update({ estagio_id: destino.id })
            .eq('id', leadId);
          if (updErr) throw new Error(updErr.message);
          break;
        }
        case 'definir_status': {
          const { error: updErr } = await db
            .from('leads')
            .update({ status: acao.status })
            .eq('id', leadId);
          if (updErr) throw new Error(updErr.message);
          break;
        }
        case 'criar_evento': {
          await criarEventoLead(db, {
            agenciaId,
            leadId,
            tipo: 'automacao',
            payload: { descricao: acao.descricao, automacao: automacaoNome },
          });
          break;
        }
      }
      acoesExecutadas.push(acao.tipo);
    } catch (e) {
      erro = e instanceof Error ? e.message : 'erro desconhecido';
      break; // uma ação falhou: para a cadeia desta automação (ordem importa).
    }
  }

  return erro ? { acoesExecutadas, erro } : { acoesExecutadas };
}

async function dispararAutomacoes(
  db: DbClient,
  params: {
    agenciaId: string;
    clienteId: string;
    leadId: string;
    gatilho: 'lead_criado' | 'lead_mudou_estagio';
    contexto: { origem: string; estagioNome?: string };
  },
): Promise<void> {
  const { agenciaId, clienteId, leadId, gatilho, contexto } = params;

  const { data: automacoes, error } = await db
    .from('automacoes')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('gatilho', gatilho)
    .eq('ativo', true);
  if (error) throw new HttpError(500, 'Falha ao carregar automações', error.message);

  for (const automacao of automacoes as Automacao[]) {
    if (!condicoesBatem(automacao.condicoes, contexto)) continue;

    const resultado = await executarAcoes(db, {
      agenciaId,
      leadId,
      automacaoNome: automacao.nome,
      acoes: automacao.acoes,
    });

    const { error: execErr } = await db.from('execucoes_automacao').insert({
      agencia_id: agenciaId,
      automacao_id: automacao.id,
      lead_id: leadId,
      resultado: resultado as unknown as Json,
    });
    if (execErr) throw new HttpError(500, 'Falha ao registrar execução', execErr.message);
  }
}
