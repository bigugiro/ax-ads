/**
 * Studio criativo IA (Sprint 6, Seção 5 do plano): geração de copy/headlines
 * via Sonnet e classificação via Haiku, com log de custo por chamada.
 *
 * `custoGeracao` é o núcleo PURO (sem IO) — testável isoladamente, sem bater
 * na API da Anthropic. A tabela de preços mora só aqui para nunca divergir
 * entre o que a rota calcula e o que o teste espera.
 */
import { z } from 'zod';
import { uuidSchema } from './schemas';

// ----- Enums (espelham os types do Postgres em 0011_ia_schema.sql) -----
export const tipoCreativoSchema = z.enum(['copy', 'headline', 'imagem']);
export const origemCreativoSchema = z.enum(['ia', 'manual']);
export const statusCreativoSchema = z.enum(['rascunho', 'aprovado', 'descartado']);
export const modeloIASchema = z.enum(['haiku', 'sonnet', 'imagem']);

export type TipoCreativo = z.infer<typeof tipoCreativoSchema>;
export type OrigemCreativo = z.infer<typeof origemCreativoSchema>;
export type StatusCreativo = z.infer<typeof statusCreativoSchema>;
export type ModeloIA = z.infer<typeof modeloIASchema>;

// ----- criativos / variacoes_criativo -----
export const criativoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  tipo: tipoCreativoSchema,
  conteudo: z.string().min(1),
  origem: origemCreativoSchema,
  status: statusCreativoSchema,
  created_at: z.string(),
});
export type Criativo = z.infer<typeof criativoSchema>;

export const variacaoCriativoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  criativo_id: uuidSchema,
  conteudo: z.string().min(1),
  metrica_ref: z.string().nullable(),
  created_at: z.string(),
});
export type VariacaoCriativo = z.infer<typeof variacaoCriativoSchema>;

/** `criativos` + suas `variacoes_criativo` (resposta de leitura). */
export interface CriativoComVariacoes extends Criativo {
  variacoes: VariacaoCriativo[];
}

// ----- geracoes_ia (log de custo) -----
export const geracaoIASchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  modelo: modeloIASchema,
  prompt: z.string(),
  resultado: z.unknown(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  custo: z.number().nonnegative(),
  created_at: z.string(),
});
export type GeracaoIA = z.infer<typeof geracaoIASchema>;

// ----- Payloads de rota -----

const briefingBase = {
  cliente_id: uuidSchema,
  produto: z.string().trim().min(1).max(200),
  publico: z.string().trim().min(1).max(300),
  tom: z.string().trim().min(1).max(120).optional(),
  oferta: z.string().trim().min(1).max(300).optional(),
  quantidade: z.number().int().min(1).max(5).default(3),
};

/** Payload de `POST /ia/copy` — gera variações de texto de anúncio (Sonnet). */
export const gerarCopySchema = z.object(briefingBase);
export type GerarCopy = z.infer<typeof gerarCopySchema>;

/** Payload de `POST /ia/headlines` — gera variações de título (Sonnet). */
export const gerarHeadlinesSchema = z.object(briefingBase);
export type GerarHeadlines = z.infer<typeof gerarHeadlinesSchema>;

/** Payload de `POST /ia/analise` — classifica um criativo existente (Haiku). */
export const analisarCriativoSchema = z.object({
  cliente_id: uuidSchema,
  texto: z.string().trim().min(1).max(2000),
});
export type AnalisarCriativo = z.infer<typeof analisarCriativoSchema>;

/** Payload de `POST /ia/imagem` — gera variações de imagem de anúncio. */
export const gerarImagemSchema = z.object({
  cliente_id: uuidSchema,
  produto: z.string().trim().min(1).max(200),
  estilo: z.string().trim().min(1).max(120).optional(),
  quantidade: z.number().int().min(1).max(4).default(2),
});
export type GerarImagem = z.infer<typeof gerarImagemSchema>;

/** Classificação estruturada devolvida pela análise via Haiku. */
export const classificacaoCriativoSchema = z.object({
  angulo: z.enum(['dor', 'desejo', 'prova_social', 'oferta', 'curiosidade']),
  tom: z.string().min(1).max(60),
  forca_cta: z.number().int().min(1).max(5),
  sugestao: z.string().min(1).max(300),
});
export type ClassificacaoCriativo = z.infer<typeof classificacaoCriativoSchema>;

/** Query de `GET /clientes/:id/criativos` e `.../geracoes-ia` — sem filtros por ora. */
export const listarCriativosQuerySchema = z.object({
  tipo: tipoCreativoSchema.optional(),
});
export type ListarCriativosQuery = z.infer<typeof listarCriativosQuerySchema>;

// ----- Custo (PURO — sem IO, testável isoladamente) -----

/**
 * Preço por milhão de tokens (USD), tabela cacheada em 2026-06-24. Mantida à
 * mão — atualizar se a Anthropic mudar preços (ver ANTHROPIC_API_KEY no README).
 */
export const PRECOS_IA: Record<ModeloIA, { input: number; output: number }> = {
  sonnet: { input: 3.0, output: 15.0 }, // claude-sonnet-5
  haiku: { input: 1.0, output: 5.0 }, // claude-haiku-4-5
  // Geração de imagem não é por token — o provider `demo` (Sprint 8) não tem
  // custo real; um provedor de imagem real calcula o próprio custo por
  // chamada (preço fixo por imagem), sem passar por `custoGeracao`.
  imagem: { input: 0, output: 0 },
};

/** Custo em USD de uma chamada, a partir dos tokens consumidos. */
export function custoGeracao(modelo: ModeloIA, tokensIn: number, tokensOut: number): number {
  const preco = PRECOS_IA[modelo];
  const custo = (tokensIn / 1_000_000) * preco.input + (tokensOut / 1_000_000) * preco.output;
  // 6 casas — o custo de uma chamada isolada é fração de centavo.
  return Math.round(custo * 1_000_000) / 1_000_000;
}
