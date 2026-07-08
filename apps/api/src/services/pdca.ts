/**
 * Motor PDCA (Sprint 7, Seção 7 do plano) — parte IO.
 *
 * Check: para cada campanha ativa, compara o período atual x anterior
 * (reaproveita `carregarResumoPorCampanha`, Sprint 2) e roda o detector puro
 * `detectarAnomalias`. Cada anomalia é gravada em `anomalias`; anomalias
 * média/alta (`mereceRecomendacao`) também viram uma linha em `recomendacoes`
 * — o texto é escrito pelo Haiku quando a chave da Anthropic está disponível,
 * com fallback textual (origem='regra') caso contrário, para o cron nunca falhar
 * por indisponibilidade da IA.
 *
 * Do: `aplicarRecomendacao` aprova/aplica — para `pausar_campanha` chama
 * `operarCampanha` (Sprint 3) de verdade via `AdsProvider`.
 *
 * Roda com a SERVICE ROLE (varre todas as agências, como os demais crons) —
 * regra 5 do CLAUDE.md continua garantida pois `operarCampanha` audita.
 */
import {
  type Anomalia,
  type AnomaliaComContexto,
  type AtualizarRecomendacao,
  type CriarRegraOtimizacao,
  type Json,
  type ListarRecomendacoesQuery,
  type ListarRegrasQuery,
  type Recomendacao,
  type RecomendacaoComContexto,
  type RegraOtimizacao,
  detectarAnomalias,
  mereceRecomendacao,
} from '@ax-ads/shared';
import { getAnthropicClient, MODELOS_ANTHROPIC } from '../lib/anthropic';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { operarCampanha } from './campanhas';
import { carregarResumoPorCampanha } from './metricas-dashboard';

const DIAS_JANELA = 7;

interface CampanhaMonitorada {
  id: string;
  nome: string;
  agenciaId: string;
  clienteId: string;
}

/** Texto padrão quando a IA não está disponível — cron não pode falhar por isso. */
function descricaoFallback(nome: string, metrica: 'cpa' | 'roas', variacaoPct: number): string {
  const pct = Math.round(variacaoPct * 100);
  if (metrica === 'cpa') return `CPA da campanha "${nome}" subiu ${pct}% no período — considere revisar ou pausar.`;
  return `ROAS da campanha "${nome}" caiu ${pct}% no período — considere revisar a campanha.`;
}

async function gerarTextoRecomendacao(params: {
  nome: string;
  metrica: 'cpa' | 'roas';
  valor: number;
  esperado: number;
  variacaoPct: number;
}): Promise<{ descricao: string; impactoEstimado: string; origem: 'ia' | 'regra' }> {
  const { nome, metrica, valor, esperado, variacaoPct } = params;
  try {
    const anthropic = getAnthropicClient();
    const resposta = await anthropic.messages.create({
      model: MODELOS_ANTHROPIC.haiku,
      max_tokens: 300,
      system:
        'Você é um analista de tráfego pago para e-commerce. Escreva uma recomendação curta e objetiva ' +
        '(1-2 frases) e uma estimativa de impacto (1 frase) para o gestor decidir se aprova. ' +
        'Responda SOMENTE com o JSON pedido, sem texto fora do schema.',
      messages: [
        {
          role: 'user',
          content:
            `Campanha "${nome}" teve anomalia de ${metrica.toUpperCase()}: valor atual ${valor.toFixed(2)}, ` +
            `esperado (período anterior) ${esperado.toFixed(2)}, variação ${(variacaoPct * 100).toFixed(0)}%. ` +
            `Sugira uma ação (ex.: pausar, revisar criativos, ajustar lance) e o impacto estimado.`,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { descricao: { type: 'string' }, impacto_estimado: { type: 'string' } },
            required: ['descricao', 'impacto_estimado'],
            additionalProperties: false,
          },
        },
      },
    });
    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco?.text) throw new Error('sem texto');
    const parsed = JSON.parse(bloco.text) as { descricao?: string; impacto_estimado?: string };
    if (!parsed.descricao || !parsed.impacto_estimado) throw new Error('formato inesperado');
    return { descricao: parsed.descricao, impactoEstimado: parsed.impacto_estimado, origem: 'ia' };
  } catch {
    return {
      descricao: descricaoFallback(nome, metrica, variacaoPct),
      impactoEstimado: 'Impacto estimado indisponível — IA não pôde ser consultada.',
      origem: 'regra',
    };
  }
}

/** Check + Act: varre campanhas ativas, detecta anomalias e gera recomendações. */
export async function detectarEregistrarAnomalias(
  db: DbClient,
): Promise<{ campanhasAnalisadas: number; anomalias: number; recomendacoes: number }> {
  const { data: campanhasRaw, error: cmpErr } = await db
    .from('campanhas')
    .select('id, nome, agencia_id, contas_anuncio!inner(cliente_id)')
    .eq('status', 'ativa');
  if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanhas ativas', cmpErr.message);

  const campanhas: CampanhaMonitorada[] = (
    campanhasRaw as unknown as Array<{
      id: string;
      nome: string;
      agencia_id: string;
      contas_anuncio: { cliente_id: string } | { cliente_id: string }[];
    }>
  ).map((r) => {
    const conta = Array.isArray(r.contas_anuncio) ? r.contas_anuncio[0] : r.contas_anuncio;
    return { id: r.id, nome: r.nome, agenciaId: r.agencia_id, clienteId: conta!.cliente_id };
  });

  if (campanhas.length === 0) return { campanhasAnalisadas: 0, anomalias: 0, recomendacoes: 0 };

  const resumos = await carregarResumoPorCampanha(
    db,
    campanhas.map((c) => c.id),
    DIAS_JANELA,
  );

  let totalAnomalias = 0;
  let totalRecomendacoes = 0;

  for (const campanha of campanhas) {
    const par = resumos.get(campanha.id);
    if (!par) continue;
    const anomalias = detectarAnomalias(par.atual, par.anterior);
    for (const anomalia of anomalias) {
      const { error: anoErr } = await db.from('anomalias').insert({
        agencia_id: campanha.agenciaId,
        cliente_id: campanha.clienteId,
        campanha_id: campanha.id,
        metrica: anomalia.metrica,
        valor: anomalia.valor,
        esperado: anomalia.esperado,
        severidade: anomalia.severidade,
      });
      if (anoErr) throw new HttpError(500, 'Falha ao gravar anomalia', anoErr.message);
      totalAnomalias += 1;

      if (!mereceRecomendacao(anomalia.severidade)) continue;

      const texto = await gerarTextoRecomendacao({
        nome: campanha.nome,
        metrica: anomalia.metrica,
        valor: anomalia.valor,
        esperado: anomalia.esperado,
        variacaoPct: anomalia.variacaoPct,
      });

      const { error: recErr } = await db.from('recomendacoes').insert({
        agencia_id: campanha.agenciaId,
        cliente_id: campanha.clienteId,
        campanha_id: campanha.id,
        tipo: anomalia.metrica === 'cpa' ? 'pausar_campanha' : 'realocar_budget',
        alvo_entidade: campanha.nome,
        descricao: texto.descricao,
        impacto_estimado: texto.impactoEstimado,
        status: 'sugerida',
        origem: texto.origem,
      });
      if (recErr) throw new HttpError(500, 'Falha ao gravar recomendação', recErr.message);
      totalRecomendacoes += 1;
    }
  }

  return { campanhasAnalisadas: campanhas.length, anomalias: totalAnomalias, recomendacoes: totalRecomendacoes };
}

export async function listarRecomendacoes(
  db: DbClient,
  clienteId: string,
  filtros: ListarRecomendacoesQuery,
): Promise<RecomendacaoComContexto[]> {
  let query = db
    .from('recomendacoes')
    .select('*, campanhas(nome)')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (filtros.status) query = query.eq('status', filtros.status);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar recomendações', error.message);
  return (data as unknown as Array<Recomendacao & { campanhas: { nome: string } | null }>).map((r) => ({
    ...r,
    campanha_nome: r.campanhas?.nome ?? null,
  }));
}

export async function listarAnomalias(db: DbClient, clienteId: string): Promise<AnomaliaComContexto[]> {
  const { data, error } = await db
    .from('anomalias')
    .select('*, campanhas(nome)')
    .eq('cliente_id', clienteId)
    .order('detectada_em', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar anomalias', error.message);
  return (data as unknown as Array<Anomalia & { campanhas: { nome: string } | null }>).map((a) => ({
    ...a,
    campanha_nome: a.campanhas?.nome ?? null,
  }));
}

/** Do: muda o status; se aprovado como aplicável, aplica de verdade via AdsProvider. */
export async function atualizarRecomendacao(
  db: DbClient,
  params: { agenciaId: string; usuarioId: string; recomendacaoId: string; patch: AtualizarRecomendacao },
): Promise<Recomendacao> {
  const { agenciaId, usuarioId, recomendacaoId, patch } = params;

  const { data: recomendacao, error: recErr } = await db
    .from('recomendacoes')
    .select('*')
    .eq('id', recomendacaoId)
    .maybeSingle();
  if (recErr) throw new HttpError(500, 'Falha ao carregar recomendação', recErr.message);
  if (!recomendacao) throw new HttpError(404, 'Recomendação não encontrada');

  if (patch.status === 'aplicada') {
    if (recomendacao.tipo === 'pausar_campanha' && recomendacao.campanha_id) {
      await operarCampanha(db, {
        agenciaId,
        usuarioId,
        campanhaId: recomendacao.campanha_id,
        patch: { status: 'pausada' },
      });
    } else {
      throw new HttpError(409, 'Este tipo de recomendação ainda não tem aplicação automática');
    }
  }

  const { data: atualizada, error: updErr } = await db
    .from('recomendacoes')
    .update({ status: patch.status })
    .eq('id', recomendacaoId)
    .select('*')
    .single();
  if (updErr || !atualizada) throw new HttpError(500, 'Falha ao atualizar recomendação', updErr?.message);
  return atualizada;
}

export async function listarRegras(db: DbClient, filtros: ListarRegrasQuery): Promise<RegraOtimizacao[]> {
  let query = db.from('regras_otimizacao').select('*').order('created_at', { ascending: false });
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar regras', error.message);
  return data;
}

export async function criarRegra(
  db: DbClient,
  agenciaId: string,
  params: CriarRegraOtimizacao,
): Promise<RegraOtimizacao> {
  const { data, error } = await db
    .from('regras_otimizacao')
    .insert({
      agencia_id: agenciaId,
      cliente_id: params.cliente_id,
      nome: params.nome,
      condicao: params.condicao as Json,
      acao: params.acao as Json,
      guardrails: params.guardrails as Json,
    })
    .select('*')
    .single();
  if (error || !data) throw new HttpError(500, 'Falha ao criar regra', error?.message);
  return data;
}

export async function atualizarRegra(
  db: DbClient,
  regraId: string,
  ativo: boolean,
): Promise<RegraOtimizacao> {
  const { data, error } = await db
    .from('regras_otimizacao')
    .update({ ativo })
    .eq('id', regraId)
    .select('*')
    .single();
  if (error || !data) throw new HttpError(500, 'Falha ao atualizar regra', error?.message);
  return data;
}
