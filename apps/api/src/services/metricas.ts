/**
 * Leitura agregada de métricas para o Dashboard (Sprint 2).
 *
 * Roda com o client do USUÁRIO (RLS aplicada): só enxerga o que é da agência.
 * Agrega SEMPRE no nível `campanha` do espelho — somar conjuntos/anúncios junto
 * contaria o mesmo gasto várias vezes. As razões (ROAS/CAC/CPA/CTR) são
 * derivadas sobre as somas em `@ax-ads/shared`.
 */
import type {
  Database,
  LimitesPeriodo,
  MetricasBrutas,
  MetricasDerivadas,
  PeriodoMetricas,
} from '@ax-ads/shared';
import { agregarPorChave, derivarMetricas, METRICAS_ZERO, resumirMetricas } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import { periodoUltimosDias } from '../lib/sync-espelho';
import type { DbClient } from '../lib/supabase';

/** Janela padrão do dashboard quando a query não informa período. */
const DIAS_PADRAO_DASHBOARD = 30;

/** Resolve o período: usa `inicio`/`fim` da query, ou os últimos 30 dias fechados. */
export function periodoDaQuery(q: LimitesPeriodo): PeriodoMetricas {
  if (q.inicio && q.fim) return { inicio: q.inicio, fim: q.fim };
  return periodoUltimosDias(DIAS_PADRAO_DASHBOARD);
}

type LinhaMetrica = Pick<
  Database['public']['Tables']['metricas_diarias']['Row'],
  'entidade_id' | 'impressoes' | 'cliques' | 'gasto' | 'conversoes' | 'receita'
>;

/** Extrai as somas cruas de uma linha do banco (ignora as colunas derivadas). */
function brutasDaLinha(r: LinhaMetrica): MetricasBrutas {
  return {
    impressoes: r.impressoes,
    cliques: r.cliques,
    gasto: r.gasto,
    conversoes: r.conversoes,
    receita: r.receita,
  };
}

/** Busca as métricas nível-campanha do período para um conjunto de campanhas. */
async function metricasDasCampanhas(
  db: DbClient,
  campanhaIds: readonly string[],
  periodo: PeriodoMetricas,
): Promise<LinhaMetrica[]> {
  if (campanhaIds.length === 0) return [];
  const { data, error } = await db
    .from('metricas_diarias')
    .select('entidade_id, impressoes, cliques, gasto, conversoes, receita')
    .eq('entidade_tipo', 'campanha')
    .in('entidade_id', campanhaIds)
    .gte('data', periodo.inicio)
    .lte('data', periodo.fim);
  if (error) throw new HttpError(500, 'Falha ao carregar métricas', error.message);
  return data ?? [];
}

export interface ResumoCliente {
  cliente_id: string;
  nome: string;
  metricas: MetricasDerivadas;
}

export interface ResumoAgencia {
  periodo: PeriodoMetricas;
  total: MetricasDerivadas;
  porCliente: ResumoCliente[];
}

/**
 * Resumo do dashboard: total da agência + quebra por cliente, no período.
 * Com `clienteId`, restringe a um único cliente (404 se não existir/for de
 * outra agência — a RLS já o esconde).
 */
export async function resumoDaAgencia(
  db: DbClient,
  periodo: PeriodoMetricas,
  clienteId?: string,
): Promise<ResumoAgencia> {
  // Clientes (para nome e para incluir quem ainda não tem métrica no período).
  let clientesQ = db.from('clientes').select('id, nome').order('nome');
  if (clienteId) clientesQ = clientesQ.eq('id', clienteId);
  const { data: clientes, error: cliErr } = await clientesQ;
  if (cliErr) throw new HttpError(500, 'Falha ao carregar clientes', cliErr.message);
  if (clienteId && (clientes ?? []).length === 0) {
    throw new HttpError(404, 'Cliente não encontrado');
  }

  // Contas → cliente, para mapear campanha → cliente.
  let contasQ = db.from('contas_anuncio').select('id, cliente_id');
  if (clienteId) contasQ = contasQ.eq('cliente_id', clienteId);
  const { data: contas, error: contasErr } = await contasQ;
  if (contasErr) throw new HttpError(500, 'Falha ao carregar contas', contasErr.message);
  const clienteDaConta = new Map((contas ?? []).map((c) => [c.id, c.cliente_id]));

  // Campanhas das contas → cliente.
  const contaIds = [...clienteDaConta.keys()];
  const clienteDaCampanha = new Map<string, string>();
  if (contaIds.length > 0) {
    const { data: campanhas, error: cmpErr } = await db
      .from('campanhas')
      .select('id, conta_anuncio_id')
      .in('conta_anuncio_id', contaIds);
    if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanhas', cmpErr.message);
    for (const cmp of campanhas ?? []) {
      const cli = clienteDaConta.get(cmp.conta_anuncio_id);
      if (cli) clienteDaCampanha.set(cmp.id, cli);
    }
  }

  const metricas = await metricasDasCampanhas(db, [...clienteDaCampanha.keys()], periodo);

  const brutasPorCliente = agregarPorChave(
    metricas,
    (m) => clienteDaCampanha.get(m.entidade_id) ?? '',
    brutasDaLinha,
  );

  const porCliente: ResumoCliente[] = (clientes ?? []).map((c) => ({
    cliente_id: c.id,
    nome: c.nome,
    metricas: derivarMetricas(brutasPorCliente.get(c.id) ?? { ...METRICAS_ZERO }),
  }));

  return { periodo, total: resumirMetricas(metricas.map(brutasDaLinha)), porCliente };
}

export interface CampanhaComMetricas {
  campanha: Pick<
    Database['public']['Tables']['campanhas']['Row'],
    'id' | 'nome' | 'objetivo' | 'status' | 'budget' | 'budget_tipo'
  >;
  metricas: MetricasDerivadas;
}

export interface CampanhasDoCliente {
  periodo: PeriodoMetricas;
  total: MetricasDerivadas;
  campanhas: CampanhaComMetricas[];
}

/**
 * Campanhas de um cliente com as métricas agregadas do período (uma linha por
 * campanha + total). Assume que o cliente já foi validado pela rota (RLS + 404).
 */
export async function campanhasDoClienteComMetricas(
  db: DbClient,
  clienteId: string,
  periodo: PeriodoMetricas,
): Promise<CampanhasDoCliente> {
  const { data: contas, error: contasErr } = await db
    .from('contas_anuncio')
    .select('id')
    .eq('cliente_id', clienteId);
  if (contasErr) throw new HttpError(500, 'Falha ao carregar contas', contasErr.message);
  const contaIds = (contas ?? []).map((c) => c.id);

  let campanhas: CampanhaComMetricas['campanha'][] = [];
  if (contaIds.length > 0) {
    const { data, error } = await db
      .from('campanhas')
      .select('id, nome, objetivo, status, budget, budget_tipo')
      .in('conta_anuncio_id', contaIds)
      .order('nome');
    if (error) throw new HttpError(500, 'Falha ao carregar campanhas', error.message);
    campanhas = data ?? [];
  }

  const metricas = await metricasDasCampanhas(
    db,
    campanhas.map((c) => c.id),
    periodo,
  );
  const brutasPorCampanha = agregarPorChave(metricas, (m) => m.entidade_id, brutasDaLinha);

  return {
    periodo,
    total: resumirMetricas(metricas.map(brutasDaLinha)),
    campanhas: campanhas.map((campanha) => ({
      campanha,
      metricas: derivarMetricas(brutasPorCampanha.get(campanha.id) ?? { ...METRICAS_ZERO }),
    })),
  };
}
