/**
 * Serviço do Studio criativo IA (Sprint 6, Seção 5 do plano): Sonnet gera
 * copy/headlines, Haiku classifica um criativo existente. Toda chamada é
 * logada em `geracoes_ia` com tokens e custo (Seção 2: log de custo).
 *
 * Usa Structured Outputs (`output_config.format`) para garantir JSON válido
 * na resposta — sem parsing frágil de texto livre. A validação de negócio
 * (enum de ângulo, faixa de força do CTA) roda no schema Zod compartilhado
 * depois do parse, já que o JSON Schema da API não suporta essas restrições.
 */
import {
  classificacaoCriativoSchema,
  custoGeracao,
  type AnalisarCriativo,
  type ClassificacaoCriativo,
  type CriativoComVariacoes,
  type GerarCopy,
  type Json,
  type ListarCriativosQuery,
  type TipoCreativo,
  type VariacaoCriativo,
} from '@ax-ads/shared';
import { z } from 'zod';
import { getAnthropicClient, MODELOS_ANTHROPIC } from '../lib/anthropic';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';

const variacoesOutputSchema = z.object({ variacoes: z.array(z.string().min(1)).min(1) });

const VARIACOES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    variacoes: { type: 'array', items: { type: 'string' } },
  },
  required: ['variacoes'],
  additionalProperties: false,
};

const CLASSIFICACAO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    angulo: { type: 'string', enum: ['dor', 'desejo', 'prova_social', 'oferta', 'curiosidade'] },
    tom: { type: 'string' },
    forca_cta: { type: 'integer' },
    sugestao: { type: 'string' },
  },
  required: ['angulo', 'tom', 'forca_cta', 'sugestao'],
  additionalProperties: false,
};

/** Extrai e faz o parse do JSON do primeiro bloco de texto da resposta. */
function extrairJson(resposta: { content: Array<{ type: string; text?: string }> }): unknown {
  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco?.text) throw new HttpError(502, 'Resposta da IA veio sem conteúdo de texto');
  try {
    return JSON.parse(bloco.text);
  } catch {
    throw new HttpError(502, 'Resposta da IA não é um JSON válido');
  }
}

/**
 * O JSON Schema de Structured Outputs da Anthropic não suporta `minimum`/
 * `maximum` (só tipo e enum) — o prompt pede escala 1-5, mas nada garante
 * que o modelo respeite. Normaliza defensivamente antes de validar.
 */
function normalizarForcaCta(bruto: unknown): unknown {
  if (typeof bruto !== 'object' || bruto === null || !('forca_cta' in bruto)) return bruto;
  const valor = bruto.forca_cta;
  if (typeof valor !== 'number') return bruto;
  const normalizado = Math.min(5, Math.max(1, Math.round(valor)));
  return { ...bruto, forca_cta: normalizado };
}

// GerarCopy e GerarHeadlines têm o mesmo shape (mesmo schema de briefing) — um tipo cobre os dois.
function montarPromptBriefing(payload: GerarCopy): string {
  const partes = [`Produto/loja: ${payload.produto}`, `Público-alvo: ${payload.publico}`];
  if (payload.tom) partes.push(`Tom de voz: ${payload.tom}`);
  if (payload.oferta) partes.push(`Oferta/gancho: ${payload.oferta}`);
  return partes.join('\n');
}

async function registrarGeracao(
  db: DbClient,
  params: {
    agenciaId: string;
    clienteId: string;
    modelo: 'sonnet' | 'haiku';
    prompt: string;
    resultado: unknown;
    tokensIn: number;
    tokensOut: number;
  },
): Promise<{ tokensIn: number; tokensOut: number; custo: number }> {
  const custo = custoGeracao(params.modelo, params.tokensIn, params.tokensOut);
  const { error } = await db.from('geracoes_ia').insert({
    agencia_id: params.agenciaId,
    cliente_id: params.clienteId,
    modelo: params.modelo,
    prompt: params.prompt,
    resultado: params.resultado as Json,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
    custo,
  });
  if (error) throw new HttpError(500, 'Falha ao registrar geração de IA', error.message);
  return { tokensIn: params.tokensIn, tokensOut: params.tokensOut, custo };
}

/** Gera `quantidade` variações de copy ou headline via Sonnet e persiste tudo. */
export async function gerarVariacoes(
  db: DbClient,
  params: {
    agenciaId: string;
    tipo: Extract<TipoCreativo, 'copy' | 'headline'>;
    payload: GerarCopy;
  },
): Promise<{ criativo: CriativoComVariacoes; custo: number }> {
  const { agenciaId, tipo, payload } = params;

  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', payload.cliente_id)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  const briefing = montarPromptBriefing(payload);
  const instrucao =
    tipo === 'headline'
      ? `Escreva ${payload.quantidade} títulos (headlines) de anúncio para e-commerce, curtos (até 60 caracteres), diretos, sem emoji, cada um uma variação de ângulo diferente.`
      : `Escreva ${payload.quantidade} textos de anúncio (copy) para e-commerce, entre 2 e 4 frases cada, focados em conversão, sem emoji, cada um uma variação de ângulo diferente.`;

  const anthropic = getAnthropicClient();
  const resposta = await anthropic.messages.create({
    model: MODELOS_ANTHROPIC.sonnet,
    max_tokens: 1024,
    system:
      'Você é um copywriter de performance especializado em e-commerce brasileiro. ' +
      'Responda SOMENTE com o JSON pedido, sem texto fora do schema.',
    messages: [{ role: 'user', content: `${instrucao}\n\n${briefing}` }],
    output_config: { format: { type: 'json_schema', schema: VARIACOES_JSON_SCHEMA } },
  });

  const parsedRaw = extrairJson(resposta);
  const parsed = variacoesOutputSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    throw new HttpError(502, 'Resposta da IA não bateu com o formato esperado');
  }

  const { data: criativo, error: criErr } = await db
    .from('criativos')
    .insert({ agencia_id: agenciaId, cliente_id: payload.cliente_id, tipo, conteudo: briefing })
    .select('*')
    .single();
  if (criErr || !criativo) throw new HttpError(500, 'Falha ao salvar criativo', criErr?.message);

  const { data: variacoes, error: varErr } = await db
    .from('variacoes_criativo')
    .insert(
      parsed.data.variacoes.map((conteudo) => ({
        agencia_id: agenciaId,
        criativo_id: criativo.id,
        conteudo,
      })),
    )
    .select('*');
  if (varErr) throw new HttpError(500, 'Falha ao salvar variações', varErr.message);

  const { custo } = await registrarGeracao(db, {
    agenciaId,
    clienteId: payload.cliente_id,
    modelo: 'sonnet',
    prompt: briefing,
    resultado: parsed.data,
    tokensIn: resposta.usage.input_tokens,
    tokensOut: resposta.usage.output_tokens,
  });

  return {
    criativo: { ...criativo, variacoes },
    custo,
  };
}

/** Classifica um texto de criativo (ângulo, tom, força do CTA) via Haiku. */
export async function analisarCriativo(
  db: DbClient,
  params: { agenciaId: string; payload: AnalisarCriativo },
): Promise<{ classificacao: ClassificacaoCriativo; custo: number }> {
  const { agenciaId, payload } = params;

  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', payload.cliente_id)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  const anthropic = getAnthropicClient();
  const resposta = await anthropic.messages.create({
    model: MODELOS_ANTHROPIC.haiku,
    max_tokens: 512,
    system:
      'Você classifica criativos de anúncio de e-commerce. ' +
      'forca_cta é um inteiro de 1 (fraco) a 5 (forte) — nunca fora dessa escala. ' +
      'Responda SOMENTE com o JSON pedido, sem texto fora do schema.',
    messages: [{ role: 'user', content: `Classifique este criativo:\n\n${payload.texto}` }],
    output_config: { format: { type: 'json_schema', schema: CLASSIFICACAO_JSON_SCHEMA } },
  });

  const parsedRaw = normalizarForcaCta(extrairJson(resposta));
  const parsed = classificacaoCriativoSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    throw new HttpError(502, 'Resposta da IA não bateu com o formato esperado');
  }

  const { custo } = await registrarGeracao(db, {
    agenciaId,
    clienteId: payload.cliente_id,
    modelo: 'haiku',
    prompt: payload.texto,
    resultado: parsed.data,
    tokensIn: resposta.usage.input_tokens,
    tokensOut: resposta.usage.output_tokens,
  });

  return { classificacao: parsed.data, custo };
}

export async function listarCriativos(
  db: DbClient,
  clienteId: string,
  filtros: ListarCriativosQuery,
): Promise<CriativoComVariacoes[]> {
  let query = db
    .from('criativos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
  const { data: criativos, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar criativos', error.message);
  if (criativos.length === 0) return [];

  const { data: variacoes, error: varErr } = await db
    .from('variacoes_criativo')
    .select('*')
    .in(
      'criativo_id',
      criativos.map((c) => c.id),
    );
  if (varErr) throw new HttpError(500, 'Falha ao carregar variações', varErr.message);

  return criativos.map((c) => ({
    ...c,
    variacoes: (variacoes as VariacaoCriativo[]).filter((v) => v.criativo_id === c.id),
  }));
}

export async function listarGeracoesIA(db: DbClient, clienteId: string) {
  const { data, error } = await db
    .from('geracoes_ia')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar gerações de IA', error.message);
  return data;
}
