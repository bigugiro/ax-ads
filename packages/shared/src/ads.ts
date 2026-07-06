/**
 * Schemas Zod do domínio de anúncios (Sprint 1): contas, espelho de campanhas
 * e métricas diárias. Mesma convenção do Sprint 0: `*Schema` valida a linha
 * completa; `conectar*`/`atualizar*` validam payload de rota.
 */
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './schemas';

// ----- Enums (espelham os types do Postgres em 0003_ads_data.sql) -----
export const plataformaSchema = z.enum(['demo', 'meta', 'google']);
export const statusContaSchema = z.enum(['ativa', 'pausada', 'desconectada']);
export const statusEntregaSchema = z.enum(['ativa', 'pausada', 'arquivada']);
export const budgetTipoSchema = z.enum(['diario', 'vitalicio']);
export const entidadeMetricaSchema = z.enum(['campanha', 'conjunto', 'anuncio']);

export type Plataforma = z.infer<typeof plataformaSchema>;
export type StatusConta = z.infer<typeof statusContaSchema>;
export type StatusEntrega = z.infer<typeof statusEntregaSchema>;
export type BudgetTipo = z.infer<typeof budgetTipoSchema>;
export type EntidadeMetrica = z.infer<typeof entidadeMetricaSchema>;

// Data-calendário (YYYY-MM-DD) — formato da coluna `date` no PostgREST.
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD');

const externalIdSchema = z.string().trim().min(1).max(120);
const nomeCurtoSchema = z.string().trim().min(1).max(120);
const nomeLongoSchema = z.string().trim().min(1).max(200);

// ----- contas_anuncio -----
export const contaAnuncioSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  plataforma: plataformaSchema,
  external_account_id: externalIdSchema,
  nome: nomeCurtoSchema,
  moeda: z.string().length(3),
  token_ref: z.string().nullable(),
  escopo: z.string().nullable(),
  status: statusContaSchema,
  ultimo_sync_at: isoDateTimeSchema.nullable(),
  created_at: isoDateTimeSchema,
});

/** Payload de `POST /contas` — conectar uma conta de anúncio a um cliente. */
export const conectarContaSchema = z.object({
  cliente_id: uuidSchema,
  plataforma: plataformaSchema,
  external_account_id: externalIdSchema,
});

/** Payload de `PATCH /contas/:id` — pausar/reativar a conexão. */
export const atualizarContaSchema = z.object({
  status: z.enum(['ativa', 'pausada']),
});

/** Query de `GET /contas` — filtro opcional por cliente. */
export const listarContasQuerySchema = z.object({
  cliente_id: uuidSchema.optional(),
});

/** Query de `GET /campanhas` — filtros opcionais por cliente ou conta. */
export const listarCampanhasQuerySchema = z.object({
  cliente_id: uuidSchema.optional(),
  conta_anuncio_id: uuidSchema.optional(),
});

/**
 * Payload de `PATCH /campanhas/:id` — operar campanha (Sprint 3).
 * status pausa/reativa; budget ajusta o orçamento (positivo). Ao menos um.
 */
export const atualizarCampanhaSchema = z
  .object({
    status: z.enum(['ativa', 'pausada']).optional(),
    budget: z.number().positive().max(1_000_000).optional(),
  })
  .refine((d) => d.status !== undefined || d.budget !== undefined, {
    message: 'Informe status e/ou budget',
  });

// ----- campanhas / conjuntos / anuncios (espelho) -----
export const campanhaSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  conta_anuncio_id: uuidSchema,
  external_id: externalIdSchema,
  nome: nomeLongoSchema,
  objetivo: z.string().min(1),
  status: statusEntregaSchema,
  budget: z.number().nonnegative(),
  budget_tipo: budgetTipoSchema,
  created_at: isoDateTimeSchema,
});

export const conjuntoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  campanha_id: uuidSchema,
  external_id: externalIdSchema,
  nome: nomeLongoSchema,
  status: statusEntregaSchema,
  budget: z.number().nonnegative().nullable(),
  publico: z.unknown().nullable(),
  created_at: isoDateTimeSchema,
});

export const anuncioSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  conjunto_id: uuidSchema,
  external_id: externalIdSchema,
  nome: nomeLongoSchema,
  status: statusEntregaSchema,
  criativo_ref: z.string().nullable(),
  created_at: isoDateTimeSchema,
});

// ----- metricas_diarias -----
// ctr/cpa/roas são colunas geradas no banco — presentes na linha, nunca no insert.
export const metricaDiariaSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  entidade_tipo: entidadeMetricaSchema,
  entidade_id: uuidSchema,
  data: isoDateSchema,
  impressoes: z.number().int().nonnegative(),
  cliques: z.number().int().nonnegative(),
  gasto: z.number().nonnegative(),
  conversoes: z.number().int().nonnegative(),
  receita: z.number().nonnegative(),
  ctr: z.number().nonnegative(),
  cpa: z.number().nonnegative().nullable(),
  roas: z.number().nonnegative().nullable(),
  created_at: isoDateTimeSchema,
});

// ----- Tipos inferidos -----
export type ContaAnuncio = z.infer<typeof contaAnuncioSchema>;
export type ConectarConta = z.infer<typeof conectarContaSchema>;
export type AtualizarConta = z.infer<typeof atualizarContaSchema>;
export type ListarContasQuery = z.infer<typeof listarContasQuerySchema>;
export type Campanha = z.infer<typeof campanhaSchema>;
export type ListarCampanhasQuery = z.infer<typeof listarCampanhasQuerySchema>;
export type AtualizarCampanha = z.infer<typeof atualizarCampanhaSchema>;
export type Conjunto = z.infer<typeof conjuntoSchema>;

/** Campanha do espelho enriquecida com contexto de conta/cliente (GET /campanhas). */
export interface CampanhaComContexto extends Campanha {
  cliente_id: string;
  cliente_nome: string;
  conta_nome: string;
  plataforma: Plataforma;
}
export type Anuncio = z.infer<typeof anuncioSchema>;
export type MetricaDiaria = z.infer<typeof metricaDiariaSchema>;
