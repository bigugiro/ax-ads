/**
 * Domínio de Estratégias (Sprint 4, Seção 6 do plano) — catálogo global +
 * aplicação por cliente + checklist executável + medição de resultado.
 *
 * `resultado` reaproveita `MetricasResumo` do Sprint 2 (mesma agregação do
 * dashboard): a baseline é capturada no momento de aplicar; o "atual" é
 * recalculado a cada leitura via o mesmo serviço do dashboard — nunca há uma
 * segunda fórmula de ROAS/CAC no sistema.
 */
import { z } from 'zod';
import type { PeriodoMetricas } from './ads-provider';
import type { MetricasResumo } from './metricas';
import { uuidSchema } from './schemas';

// ----- Enums (espelham os types do Postgres em 0006_estrategias_schema.sql) -----
export const canalEstrategiaSchema = z.enum(['meta', 'google', 'ambos']);
export const nivelEstrategiaSchema = z.enum(['iniciante', 'avancado']);
export const impactoEstrategiaSchema = z.enum(['cac_down', 'roas_up', 'faturamento_up']);
export const statusEstrategiaAplicadaSchema = z.enum([
  'analisando',
  'aplicada',
  'pausada',
  'concluida',
]);

export type CanalEstrategia = z.infer<typeof canalEstrategiaSchema>;
export type NivelEstrategia = z.infer<typeof nivelEstrategiaSchema>;
export type ImpactoEstrategia = z.infer<typeof impactoEstrategiaSchema>;
export type StatusEstrategiaAplicada = z.infer<typeof statusEstrategiaAplicadaSchema>;

const listaTextoSchema = z.array(z.string().min(1));

// ----- estrategias (catálogo global) -----
export const estrategiaSchema = z.object({
  id: uuidSchema,
  slug: z.string().min(1).max(80),
  titulo: z.string().min(1).max(160),
  categoria: z.string().min(1).max(80),
  canal: canalEstrategiaSchema,
  objetivo: z.string().min(1).max(160),
  quando_usar: z.string().min(1),
  impacto: z.array(impactoEstrategiaSchema),
  pre_requisitos: listaTextoSchema,
  passos: listaTextoSchema,
  guardrails: listaTextoSchema,
  kpi_sucesso: z.string().min(1),
  nivel: nivelEstrategiaSchema,
  versao: z.number().int().min(1),
  ativo: z.boolean(),
  created_at: z.string(),
});
export type Estrategia = z.infer<typeof estrategiaSchema>;

/** Query de `GET /estrategias` — filtros da jornada "Analisar" (Seção 6.2). */
export const listarEstrategiasQuerySchema = z.object({
  canal: canalEstrategiaSchema.optional(),
  nivel: nivelEstrategiaSchema.optional(),
});
export type ListarEstrategiasQuery = z.infer<typeof listarEstrategiasQuerySchema>;

// ----- estrategias_aplicadas (instância por cliente) -----
export const estrategiaAplicadaSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  estrategia_id: uuidSchema,
  estrategia_versao: z.number().int().min(1),
  status: statusEstrategiaAplicadaSchema,
  aplicada_em: z.string().nullable(),
  // config/resultado são jsonb de leitura (nunca aceitos como payload de rota
  // nesta sprint) — tipados livres para não brigar com o `Json | null` do banco.
  config: z.unknown(),
  resultado: z.unknown().nullable(),
  notas: z.string().nullable(),
  created_at: z.string(),
});
export type EstrategiaAplicada = z.infer<typeof estrategiaAplicadaSchema>;

/** Resultado medido: baseline capturada ao aplicar (Sprint 2's MetricasResumo). */
export interface ResultadoEstrategia {
  periodoBaseline: PeriodoMetricas;
  baseline: MetricasResumo;
}

/** Payload de `PATCH /estrategias-aplicadas/:id` — mover status e/ou anotar. */
export const atualizarEstrategiaAplicadaSchema = z
  .object({
    status: statusEstrategiaAplicadaSchema.optional(),
    notas: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.notas !== undefined, {
    message: 'Informe status e/ou notas',
  });
export type AtualizarEstrategiaAplicada = z.infer<typeof atualizarEstrategiaAplicadaSchema>;

// ----- estrategia_checklist_itens -----
export const estrategiaChecklistItemSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  estrategia_aplicada_id: uuidSchema,
  descricao: z.string().min(1),
  feito: z.boolean(),
  ordem: z.number().int(),
  created_at: z.string(),
});
export type EstrategiaChecklistItem = z.infer<typeof estrategiaChecklistItemSchema>;

/** Payload de `PATCH /estrategia-checklist/:id` — marcar/desmarcar item. */
export const atualizarChecklistItemSchema = z.object({
  feito: z.boolean(),
});
export type AtualizarChecklistItem = z.infer<typeof atualizarChecklistItemSchema>;

// ----- Modelos de leitura enriquecidos (respostas da API, não payload) -----

/** Checklist executável (Seção 6.1: "sistema gera um checklist") com progresso. */
export interface ChecklistComProgresso {
  itens: EstrategiaChecklistItem[];
  feitos: number;
  total: number;
}

/** `estrategias_aplicadas` + contexto da estratégia + checklist + resultado medido ao vivo. */
export interface EstrategiaAplicadaComContexto extends EstrategiaAplicada {
  estrategia_titulo: string;
  estrategia_slug: string;
  estrategia_kpi_sucesso: string;
  checklist: ChecklistComProgresso;
  /** Recalculado a cada leitura (últimos 30 dias) — `null` se o cliente não tem métricas ainda. */
  atual: MetricasResumo | null;
}
