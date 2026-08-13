/**
 * Motor PDCA (Sprint 7, Seção 7 do plano): Check (detecta anomalia) → Act
 * (vira recomendação) → Do (gestor aprova/aplica) → Plan (guardrails em
 * `regras_otimizacao` moldam a próxima rodada).
 *
 * `detectarAnomalias` é o núcleo PURO do Check — sem IO, testável isoladamente.
 * Reaproveita `MetricasResumo` do Sprint 2: nenhuma segunda fórmula de CPA/ROAS.
 */
import { z } from 'zod';
import type { MetricasResumo } from './metricas';
import { uuidSchema } from './schemas';

// ----- Enums (espelham os types do Postgres em 0013_pdca_schema.sql) -----
export const tipoRecomendacaoSchema = z.enum([
  'realocar_budget',
  'aplicar_estrategia',
  'testar_criativo',
  'pausar_campanha',
]);
export const statusRecomendacaoSchema = z.enum(['sugerida', 'aprovada', 'aplicada', 'rejeitada']);
export const origemRecomendacaoSchema = z.enum(['ia', 'regra']);
/** Sprint 7 monitora CAC (via `cpa`) e ROAS — os dois KPIs do CLAUDE.md. */
export const metricaMonitoradaSchema = z.enum(['cpa', 'roas']);
export const severidadeAnomaliaSchema = z.enum(['baixa', 'media', 'alta']);

export type TipoRecomendacao = z.infer<typeof tipoRecomendacaoSchema>;
export type StatusRecomendacao = z.infer<typeof statusRecomendacaoSchema>;
export type OrigemRecomendacao = z.infer<typeof origemRecomendacaoSchema>;
export type MetricaMonitorada = z.infer<typeof metricaMonitoradaSchema>;
export type SeveridadeAnomalia = z.infer<typeof severidadeAnomaliaSchema>;

// ----- recomendacoes -----
export const recomendacaoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  campanha_id: uuidSchema.nullable(),
  tipo: tipoRecomendacaoSchema,
  alvo_entidade: z.string().min(1).max(200),
  descricao: z.string().min(1),
  impacto_estimado: z.string().min(1),
  status: statusRecomendacaoSchema,
  origem: origemRecomendacaoSchema,
  created_at: z.string(),
});
export type Recomendacao = z.infer<typeof recomendacaoSchema>;

/** Payload de `PATCH /recomendacoes/:id` — mover status. */
export const atualizarRecomendacaoSchema = z.object({
  status: statusRecomendacaoSchema,
});
export type AtualizarRecomendacao = z.infer<typeof atualizarRecomendacaoSchema>;

/** Query de `GET /clientes/:id/recomendacoes` — filtro opcional por status. */
export const listarRecomendacoesQuerySchema = z.object({
  status: statusRecomendacaoSchema.optional(),
});
export type ListarRecomendacoesQuery = z.infer<typeof listarRecomendacoesQuerySchema>;

/** `recomendacoes` + nome da campanha-alvo, quando houver (resposta de leitura). */
export interface RecomendacaoComContexto extends Recomendacao {
  campanha_nome: string | null;
}

// ----- anomalias -----
export const anomaliaSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  campanha_id: uuidSchema.nullable(),
  metrica: metricaMonitoradaSchema,
  valor: z.number(),
  esperado: z.number(),
  severidade: severidadeAnomaliaSchema,
  detectada_em: z.string(),
});
export type Anomalia = z.infer<typeof anomaliaSchema>;

export interface AnomaliaComContexto extends Anomalia {
  campanha_nome: string | null;
}

// ----- regras_otimizacao -----
export const regraOtimizacaoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  nome: z.string().min(1).max(120),
  condicao: z.unknown(),
  acao: z.unknown(),
  guardrails: z.unknown(),
  ativo: z.boolean(),
  created_at: z.string(),
});
export type RegraOtimizacao = z.infer<typeof regraOtimizacaoSchema>;

/** Payload de `POST /regras-otimizacao`. */
export const criarRegraOtimizacaoSchema = z.object({
  cliente_id: uuidSchema,
  nome: z.string().trim().min(1).max(120),
  condicao: z.record(z.string(), z.unknown()).default({}),
  acao: z.record(z.string(), z.unknown()).default({}),
  guardrails: z.record(z.string(), z.unknown()).default({}),
});
export type CriarRegraOtimizacao = z.infer<typeof criarRegraOtimizacaoSchema>;

/** Payload de `PATCH /regras-otimizacao/:id` — ligar/desligar. */
export const atualizarRegraOtimizacaoSchema = z.object({
  ativo: z.boolean(),
});
export type AtualizarRegraOtimizacao = z.infer<typeof atualizarRegraOtimizacaoSchema>;

/** Query de `GET /regras-otimizacao` — filtro por cliente. */
export const listarRegrasQuerySchema = z.object({
  cliente_id: uuidSchema.optional(),
});
export type ListarRegrasQuery = z.infer<typeof listarRegrasQuerySchema>;

// ----- Detecção de anomalia (PURO — sem IO, testável isoladamente) -----

export interface AnomaliaDetectada {
  metrica: MetricaMonitorada;
  valor: number;
  esperado: number;
  severidade: SeveridadeAnomalia;
  /** Variação relativa "para pior" (ex.: CPA subiu 42% → 0.42). Sempre positiva quando presente. */
  variacaoPct: number;
}

/** Piso de conversões no período anterior para considerar a base estatisticamente estável. */
const MIN_CONVERSOES_BASE = 3;
const LIMIAR_BAIXA = 0.15;
const LIMIAR_MEDIA = 0.3;
const LIMIAR_ALTA = 0.5;

function classificarSeveridade(variacaoRuim: number): SeveridadeAnomalia | null {
  if (variacaoRuim >= LIMIAR_ALTA) return 'alta';
  if (variacaoRuim >= LIMIAR_MEDIA) return 'media';
  if (variacaoRuim >= LIMIAR_BAIXA) return 'baixa';
  return null;
}

/**
 * Compara o período atual com o anterior (mesma dupla usada no dashboard e em
 * Estratégias — Sprint 2) e aponta desvios de CPA (subiu) e ROAS (caiu).
 * Exige uma base mínima de conversões no período anterior para não confundir
 * ruído estatístico (poucas conversões) com anomalia real.
 */
export function detectarAnomalias(
  atual: MetricasResumo,
  anterior: MetricasResumo,
): AnomaliaDetectada[] {
  if (anterior.conversoes < MIN_CONVERSOES_BASE) return [];

  const anomalias: AnomaliaDetectada[] = [];

  if (atual.cpa !== null && anterior.cpa !== null && anterior.cpa > 0) {
    const variacao = (atual.cpa - anterior.cpa) / anterior.cpa; // CPA subir é ruim
    const severidade = classificarSeveridade(variacao);
    if (severidade) {
      anomalias.push({
        metrica: 'cpa',
        valor: atual.cpa,
        esperado: anterior.cpa,
        severidade,
        variacaoPct: variacao,
      });
    }
  }

  if (atual.roas !== null && anterior.roas !== null && anterior.roas > 0) {
    const variacao = (anterior.roas - atual.roas) / anterior.roas; // ROAS cair é ruim
    const severidade = classificarSeveridade(variacao);
    if (severidade) {
      anomalias.push({
        metrica: 'roas',
        valor: atual.roas,
        esperado: anterior.roas,
        severidade,
        variacaoPct: variacao,
      });
    }
  }

  return anomalias;
}

/** Só anomalias média/alta viram recomendação automática — evita fadiga de alerta. */
export function mereceRecomendacao(severidade: SeveridadeAnomalia): boolean {
  return severidade === 'media' || severidade === 'alta';
}
