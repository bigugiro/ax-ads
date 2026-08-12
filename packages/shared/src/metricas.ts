/**
 * Agregação e derivação de métricas (Sprint 2 — Dashboard).
 *
 * O banco guarda somas cruas por entidade e dia (`metricas_diarias`); o
 * dashboard soma um período e deriva as razões de performance. As colunas
 * geradas do banco (ctr/cpa/roas) valem POR LINHA/DIA — no nível agregado a
 * razão precisa ser recalculada sobre as somas, nunca a média das razões.
 *
 * Funções PURAS e determinísticas (sem IO): a orquestração com o banco fica em
 * `apps/api/src/services/metricas.ts`. Convenção das razões: `null` quando o
 * denominador é 0 (ex.: ROAS sem gasto), exceto CTR que é 0 sem impressões.
 *
 * CAC = CPA no Sprint 2 (decisão de 2026-08-12): o provider só expõe
 * `conversoes` (compras), sem distinguir cliente novo de recorrente. Quando
 * houver dado de comprador único (tracking, Sprint 13), CAC ganha fórmula própria.
 */
import { z } from 'zod';
import { isoDateSchema } from './ads';
import { uuidSchema } from './schemas';

/** Somas cruas de um período/entidade — espelham o que o banco armazena por dia. */
export interface MetricasBrutas {
  impressoes: number;
  cliques: number;
  gasto: number;
  conversoes: number;
  receita: number;
}

/** Métricas do dashboard: somas cruas + razões derivadas. */
export interface MetricasDerivadas extends MetricasBrutas {
  /** Cliques ÷ impressões. `0` quando não houve impressão. */
  ctr: number;
  /** Custo por clique: gasto ÷ cliques. `null` sem cliques. */
  cpc: number | null;
  /** Custo por aquisição: gasto ÷ conversões. `null` sem conversões. */
  cpa: number | null;
  /** Custo de aquisição de cliente. Sprint 2: igual ao CPA. `null` sem conversões. */
  cac: number | null;
  /** Retorno sobre o investimento em anúncios: receita ÷ gasto. `null` sem gasto. */
  roas: number | null;
  /** Ticket médio: receita ÷ conversões. `null` sem conversões. */
  ticketMedio: number | null;
}

/** Métricas brutas zeradas (imutável — sempre copiar antes de somar). */
export const METRICAS_ZERO: Readonly<MetricasBrutas> = Object.freeze({
  impressoes: 0,
  cliques: 0,
  gasto: 0,
  conversoes: 0,
  receita: 0,
});

/** Arredonda para `casas` decimais (evita ruído de ponto flutuante em somas). */
function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/** Soma uma coleção de métricas brutas (linhas diárias ou por entidade). */
export function somarMetricas(itens: Iterable<MetricasBrutas>): MetricasBrutas {
  const total: MetricasBrutas = { ...METRICAS_ZERO };
  for (const m of itens) {
    total.impressoes += m.impressoes;
    total.cliques += m.cliques;
    total.gasto += m.gasto;
    total.conversoes += m.conversoes;
    total.receita += m.receita;
  }
  // gasto/receita são numeric(12,2) no banco: reancorar a soma em 2 casas.
  total.gasto = arredondar(total.gasto, 2);
  total.receita = arredondar(total.receita, 2);
  return total;
}

/** Deriva ROAS/CAC/CPA/CTR (e afins) a partir das somas cruas. */
export function derivarMetricas(b: MetricasBrutas): MetricasDerivadas {
  const cpa = b.conversoes > 0 ? arredondar(b.gasto / b.conversoes, 2) : null;
  return {
    impressoes: b.impressoes,
    cliques: b.cliques,
    gasto: arredondar(b.gasto, 2),
    conversoes: b.conversoes,
    receita: arredondar(b.receita, 2),
    ctr: b.impressoes > 0 ? arredondar(b.cliques / b.impressoes, 6) : 0,
    cpc: b.cliques > 0 ? arredondar(b.gasto / b.cliques, 2) : null,
    cpa,
    cac: cpa,
    roas: b.gasto > 0 ? arredondar(b.receita / b.gasto, 4) : null,
    ticketMedio: b.conversoes > 0 ? arredondar(b.receita / b.conversoes, 2) : null,
  };
}

/** Atalho: soma um período e já deriva as razões. */
export function resumirMetricas(itens: Iterable<MetricasBrutas>): MetricasDerivadas {
  return derivarMetricas(somarMetricas(itens));
}

/**
 * Agrupa itens por uma chave e soma as métricas de cada grupo.
 * Preserva a ordem da 1ª aparição de cada chave (útil para exibição estável).
 */
export function agregarPorChave<T>(
  itens: readonly T[],
  chaveDe: (item: T) => string,
  brutasDe: (item: T) => MetricasBrutas,
): Map<string, MetricasBrutas> {
  const grupos = new Map<string, MetricasBrutas>();
  for (const item of itens) {
    const chave = chaveDe(item);
    const acc = grupos.get(chave) ?? { ...METRICAS_ZERO };
    const m = brutasDe(item);
    acc.impressoes += m.impressoes;
    acc.cliques += m.cliques;
    acc.gasto += m.gasto;
    acc.conversoes += m.conversoes;
    acc.receita += m.receita;
    grupos.set(chave, acc);
  }
  for (const g of grupos.values()) {
    g.gasto = arredondar(g.gasto, 2);
    g.receita = arredondar(g.receita, 2);
  }
  return grupos;
}

// ----- Query de período (rotas de leitura do dashboard) -----

/** Limites de período (opcionais mas com `undefined` explícito p/ exactOptionalPropertyTypes). */
export interface LimitesPeriodo {
  inicio?: string | undefined;
  fim?: string | undefined;
}

/** `inicio`/`fim` são opcionais mas andam juntos: ou os dois, ou nenhum. */
function ambosOuNenhum(q: LimitesPeriodo): boolean {
  return Boolean(q.inicio) === Boolean(q.fim);
}
/** `inicio` não pode ser depois de `fim` (comparação lexicográfica de YYYY-MM-DD). */
function inicioAntesDeFim(q: LimitesPeriodo): boolean {
  return !q.inicio || !q.fim || q.inicio <= q.fim;
}

/** Query `?inicio=&fim=` de `GET /clientes/:id/campanhas`. */
export const periodoQuerySchema = z
  .object({ inicio: isoDateSchema.optional(), fim: isoDateSchema.optional() })
  .refine(ambosOuNenhum, { message: 'Informe inicio e fim juntos, ou nenhum', path: ['inicio'] })
  .refine(inicioAntesDeFim, { message: 'inicio deve ser <= fim', path: ['inicio'] });
export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;

/** Query `?cliente_id=&inicio=&fim=` de `GET /metricas`. */
export const metricasQuerySchema = z
  .object({
    cliente_id: uuidSchema.optional(),
    inicio: isoDateSchema.optional(),
    fim: isoDateSchema.optional(),
  })
  .refine(ambosOuNenhum, { message: 'Informe inicio e fim juntos, ou nenhum', path: ['inicio'] })
  .refine(inicioAntesDeFim, { message: 'inicio deve ser <= fim', path: ['inicio'] });
export type MetricasQuery = z.infer<typeof metricasQuerySchema>;
