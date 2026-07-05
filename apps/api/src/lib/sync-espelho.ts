/**
 * Helpers PUROS do sync provider → espelho no banco (testáveis isoladamente).
 * A orquestração com IO fica em `services/sync-conta.ts`.
 */
import type {
  Database,
  EntidadeMetrica,
  PeriodoMetricas,
  ProviderMetricaDiaria,
} from '@ax-ads/shared';

type MetricaInsert = Database['public']['Tables']['metricas_diarias']['Insert'];

/** Divide uma lista em blocos de até `tamanho` itens (inserts em lote). */
export function chunk<T>(itens: readonly T[], tamanho: number): T[][] {
  if (!Number.isInteger(tamanho) || tamanho <= 0) {
    throw new Error('Tamanho do bloco deve ser inteiro positivo');
  }
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}

/** Chave única de uma entidade do provider (tipo + id externo). */
export function chaveEntidade(tipo: EntidadeMetrica, externalId: string): string {
  return `${tipo}|${externalId}`;
}

/**
 * Janela de sync: últimos `dias` dias FECHADOS (fim = ontem, em UTC).
 * O dia corrente fica de fora — métricas parciais distorcem comparações.
 */
export function periodoUltimosDias(dias: number, hoje: Date = new Date()): PeriodoMetricas {
  if (!Number.isInteger(dias) || dias <= 0) {
    throw new Error('Quantidade de dias deve ser inteiro positivo');
  }
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 1));
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/**
 * Converte métricas do provider (ids externos) em linhas de `metricas_diarias`
 * (ids locais do espelho). Métricas de entidade sem espelho não somem em
 * silêncio: voltam contadas em `semEspelho` para o chamador decidir.
 */
export function mapearMetricasParaLinhas(
  agenciaId: string,
  metricas: readonly ProviderMetricaDiaria[],
  idLocalPorChave: ReadonlyMap<string, string>,
): { linhas: MetricaInsert[]; semEspelho: number } {
  const linhas: MetricaInsert[] = [];
  let semEspelho = 0;
  for (const m of metricas) {
    const entidadeId = idLocalPorChave.get(chaveEntidade(m.entidadeTipo, m.entidadeExternalId));
    if (!entidadeId) {
      semEspelho++;
      continue;
    }
    linhas.push({
      agencia_id: agenciaId,
      entidade_tipo: m.entidadeTipo,
      entidade_id: entidadeId,
      data: m.data,
      impressoes: m.impressoes,
      cliques: m.cliques,
      gasto: m.gasto,
      conversoes: m.conversoes,
      receita: m.receita,
    });
  }
  return { linhas, semEspelho };
}
