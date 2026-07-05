/**
 * Carrega o dashboard de métricas (Sprint 2) a partir do espelho no banco.
 * IO fino: resolve campanhas → cliente, busca métricas de NÍVEL CAMPANHA nos
 * dois períodos e delega toda a agregação para `montarDashboard` (puro).
 *
 * Roda com o client do USUÁRIO (RLS): só enxerga o que é da agência dele.
 */
import {
  janelaAnterior,
  montarDashboard,
  type CampanhaMeta,
  type DashboardMetricas,
  type MetricaCampanhaDia,
  type PeriodoMetricas,
} from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { periodoUltimosDias } from '../lib/sync-espelho';

/** Colunas cruas de métrica; PostgREST pode devolver numeric como string. */
interface LinhaMetricaDb {
  entidade_id: string;
  data: string;
  impressoes: number | string;
  cliques: number | string;
  gasto: number | string;
  conversoes: number | string;
  receita: number | string;
}

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

async function buscarMetricasCampanha(
  db: DbClient,
  periodo: PeriodoMetricas,
  campanhaIds: readonly string[],
): Promise<MetricaCampanhaDia[]> {
  if (campanhaIds.length === 0) return [];
  const { data, error } = await db
    .from('metricas_diarias')
    .select('entidade_id, data, impressoes, cliques, gasto, conversoes, receita')
    .eq('entidade_tipo', 'campanha')
    .gte('data', periodo.inicio)
    .lte('data', periodo.fim)
    .in('entidade_id', campanhaIds);
  if (error) throw new HttpError(500, 'Falha ao carregar métricas', error.message);
  return (data as LinhaMetricaDb[]).map((r) => ({
    campanhaId: r.entidade_id,
    data: r.data,
    impressoes: num(r.impressoes),
    cliques: num(r.cliques),
    gasto: num(r.gasto),
    conversoes: num(r.conversoes),
    receita: num(r.receita),
  }));
}

export async function carregarDashboard(
  db: DbClient,
  dias: number,
  clienteId?: string,
): Promise<DashboardMetricas> {
  const periodo = periodoUltimosDias(dias);
  const periodoAnterior = janelaAnterior(periodo);

  // Nome do cliente por id (RLS filtra por agência).
  let clientesQuery = db.from('clientes').select('id, nome');
  if (clienteId) clientesQuery = clientesQuery.eq('id', clienteId);
  const { data: clientes, error: cliErr } = await clientesQuery;
  if (cliErr) throw new HttpError(500, 'Falha ao carregar clientes', cliErr.message);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));

  // Conta → cliente (só das contas em escopo).
  let contasQuery = db.from('contas_anuncio').select('id, cliente_id');
  if (clienteId) contasQuery = contasQuery.eq('cliente_id', clienteId);
  const { data: contas, error: contaErr } = await contasQuery;
  if (contaErr) throw new HttpError(500, 'Falha ao carregar contas', contaErr.message);
  const clientePorConta = new Map(contas.map((c) => [c.id, c.cliente_id]));
  const contaIds = contas.map((c) => c.id);

  // Campanhas dessas contas → metadados resolvidos ao cliente dono.
  const campanhas: CampanhaMeta[] = [];
  if (contaIds.length > 0) {
    const { data: rows, error: cmpErr } = await db
      .from('campanhas')
      .select('id, nome, status, conta_anuncio_id')
      .in('conta_anuncio_id', contaIds);
    if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanhas', cmpErr.message);
    for (const r of rows) {
      const cliId = clientePorConta.get(r.conta_anuncio_id);
      if (!cliId) continue;
      campanhas.push({
        id: r.id,
        nome: r.nome,
        status: r.status,
        clienteId: cliId,
        clienteNome: nomeCliente.get(cliId) ?? '—',
      });
    }
  }

  const campanhaIds = campanhas.map((c) => c.id);
  const [metricasAtual, metricasAnterior] = await Promise.all([
    buscarMetricasCampanha(db, periodo, campanhaIds),
    buscarMetricasCampanha(db, periodoAnterior, campanhaIds),
  ]);

  return montarDashboard({ periodo, periodoAnterior, campanhas, metricasAtual, metricasAnterior });
}
