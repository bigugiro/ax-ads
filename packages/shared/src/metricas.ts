/**
 * Agregação de métricas (Sprint 2) — LÓGICA PURA, sem IO.
 *
 * O banco já deriva ctr/cpa/roas por LINHA (colunas geradas em 0003). Aqui
 * agregamos várias linhas em um resumo: os derivados são recalculados sobre os
 * TOTAIS (ponderação correta), nunca pela média dos derivados por linha —
 * média de razões mente. Fonte única do painel do dashboard.
 *
 * Convenção: quem monta o dashboard passa APENAS métricas de nível `campanha`
 * (entidade_tipo='campanha'). Somar campanha + conjunto + anúncio contaria o
 * mesmo gasto 3×; a rota é responsável por filtrar antes de chamar aqui.
 */
import { z } from 'zod';
import type { StatusEntrega } from './ads';
import type { PeriodoMetricas } from './ads-provider';
import { uuidSchema } from './schemas';

// ----- Arredondamento estável (evita drift de ponto flutuante) -----
function arred(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
}

// ----- Totais brutos e resumo derivado -----

/** Colunas cruas que somam linearmente. */
export interface MetricaLinhaBruta {
  impressoes: number;
  cliques: number;
  gasto: number;
  conversoes: number;
  receita: number;
}

export type MetricasTotais = MetricaLinhaBruta;

/** Totais + métricas derivadas do e-commerce (razões recalculadas sobre o total). */
export interface MetricasResumo extends MetricasTotais {
  /** cliques / impressões (razão 0..1); 0 quando não houve impressão. */
  ctr: number;
  /** gasto / cliques; `null` sem cliques. */
  cpc: number | null;
  /** gasto / conversões — o CAC do e-commerce; `null` sem conversão. */
  cpa: number | null;
  /** receita / gasto; `null` sem gasto. */
  roas: number | null;
  /** receita / conversões (ticket médio); `null` sem conversão. */
  ticketMedio: number | null;
}

export const TOTAIS_ZERO: MetricasTotais = {
  impressoes: 0,
  cliques: 0,
  gasto: 0,
  conversoes: 0,
  receita: 0,
};

/** Soma linhas cruas. impressões/cliques/conversões inteiros; dinheiro em 2 casas. */
export function somarTotais(linhas: readonly MetricaLinhaBruta[]): MetricasTotais {
  const t = { ...TOTAIS_ZERO };
  for (const l of linhas) {
    t.impressoes += l.impressoes;
    t.cliques += l.cliques;
    t.gasto += l.gasto;
    t.conversoes += l.conversoes;
    t.receita += l.receita;
  }
  t.gasto = arred(t.gasto, 2);
  t.receita = arred(t.receita, 2);
  return t;
}

/** Deriva ctr/cpc/cpa/roas/ticket sobre os totais, com as MESMAS regras do banco. */
export function derivarResumo(t: MetricasTotais): MetricasResumo {
  return {
    ...t,
    ctr: t.impressoes > 0 ? arred(t.cliques / t.impressoes, 6) : 0,
    cpc: t.cliques > 0 ? arred(t.gasto / t.cliques, 2) : null,
    cpa: t.conversoes > 0 ? arred(t.gasto / t.conversoes, 2) : null,
    roas: t.gasto > 0 ? arred(t.receita / t.gasto, 4) : null,
    ticketMedio: t.conversoes > 0 ? arred(t.receita / t.conversoes, 2) : null,
  };
}

/** Atalho: soma + deriva. */
export function resumirLinhas(linhas: readonly MetricaLinhaBruta[]): MetricasResumo {
  return derivarResumo(somarTotais(linhas));
}

// ----- Variação período-a-período -----

/** (atual − anterior) / anterior, em 4 casas. `null` quando não há base. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return arred((atual - anterior) / anterior, 4);
}

/** Variação de métricas que podem ser nulas (cpa/roas sem base viram `null`). */
export function variacaoNullable(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null) return null;
  return variacaoPct(atual, anterior);
}

// ----- Janela de comparação -----

/**
 * Janela imediatamente anterior de mesma duração: para [D-29 .. D] devolve
 * [D-59 .. D-30]. Datas em UTC, formato YYYY-MM-DD.
 */
export function janelaAnterior(periodo: PeriodoMetricas): PeriodoMetricas {
  const inicio = new Date(`${periodo.inicio}T00:00:00Z`);
  const fim = new Date(`${periodo.fim}T00:00:00Z`);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  const novoFim = new Date(inicio);
  novoFim.setUTCDate(novoFim.getUTCDate() - 1);
  const novoInicio = new Date(novoFim);
  novoInicio.setUTCDate(novoInicio.getUTCDate() - (dias - 1));
  return {
    inicio: novoInicio.toISOString().slice(0, 10),
    fim: novoFim.toISOString().slice(0, 10),
  };
}

// ----- Dashboard (resposta da rota GET /metricas/dashboard) -----

/** Metadados de uma campanha do espelho, já resolvida ao cliente dono. */
export interface CampanhaMeta {
  id: string;
  nome: string;
  status: StatusEntrega;
  clienteId: string;
  clienteNome: string;
}

/** Métrica diária de nível campanha (entidade_id = id da campanha). */
export interface MetricaCampanhaDia extends MetricaLinhaBruta {
  campanhaId: string;
  data: string;
}

export interface ResumoComparado {
  atual: MetricasResumo;
  anterior: MetricasResumo;
  variacao: {
    gasto: number | null;
    receita: number | null;
    conversoes: number | null;
    roas: number | null;
    cpa: number | null;
    ctr: number | null;
  };
}

export interface SerieDiaria {
  data: string;
  gasto: number;
  receita: number;
  conversoes: number;
}

export interface ResumoPorCliente {
  clienteId: string;
  nome: string;
  resumo: MetricasResumo;
}

export interface ResumoPorCampanha {
  campanhaId: string;
  nome: string;
  status: StatusEntrega;
  clienteId: string;
  clienteNome: string;
  resumo: MetricasResumo;
}

export interface DashboardMetricas {
  periodo: PeriodoMetricas;
  periodoAnterior: PeriodoMetricas;
  geral: ResumoComparado;
  serie: SerieDiaria[];
  porCliente: ResumoPorCliente[];
  porCampanha: ResumoPorCampanha[];
}

function comparar(atual: MetricasResumo, anterior: MetricasResumo): ResumoComparado {
  return {
    atual,
    anterior,
    variacao: {
      gasto: variacaoPct(atual.gasto, anterior.gasto),
      receita: variacaoPct(atual.receita, anterior.receita),
      conversoes: variacaoPct(atual.conversoes, anterior.conversoes),
      roas: variacaoNullable(atual.roas, anterior.roas),
      cpa: variacaoNullable(atual.cpa, anterior.cpa),
      ctr: variacaoPct(atual.ctr, anterior.ctr),
    },
  };
}

/**
 * Monta o dashboard a partir de dados já carregados do banco (função pura).
 * `campanhas` semeia clientes e campanhas com zero, então uma conta recém-
 * conectada aparece mesmo sem gasto no período. Métrica de campanha fora do
 * mapa (não deveria ocorrer) é ignorada em silêncio — o espelho é a verdade.
 */
export function montarDashboard(params: {
  periodo: PeriodoMetricas;
  periodoAnterior: PeriodoMetricas;
  campanhas: readonly CampanhaMeta[];
  metricasAtual: readonly MetricaCampanhaDia[];
  metricasAnterior: readonly MetricaCampanhaDia[];
}): DashboardMetricas {
  const { periodo, periodoAnterior, campanhas, metricasAtual, metricasAnterior } = params;

  const metaPorCampanha = new Map(campanhas.map((c) => [c.id, c]));

  // Acumuladores semeados em zero a partir das campanhas conhecidas.
  const totaisPorCampanha = new Map<string, MetricaLinhaBruta[]>();
  const totaisPorCliente = new Map<string, { nome: string; linhas: MetricaLinhaBruta[] }>();
  for (const c of campanhas) {
    totaisPorCampanha.set(c.id, []);
    if (!totaisPorCliente.has(c.clienteId)) {
      totaisPorCliente.set(c.clienteId, { nome: c.clienteNome, linhas: [] });
    }
  }

  const serie = new Map<string, SerieDiaria>();

  // Só linhas com campanha no espelho entram em QUALQUER agregação — assim
  // geral, série e breakdowns contam exatamente o mesmo conjunto.
  const validasAtual = metricasAtual.filter((m) => metaPorCampanha.has(m.campanhaId));
  const validasAnterior = metricasAnterior.filter((m) => metaPorCampanha.has(m.campanhaId));

  for (const m of validasAtual) {
    const meta = metaPorCampanha.get(m.campanhaId)!;
    totaisPorCampanha.get(m.campanhaId)!.push(m);
    totaisPorCliente.get(meta.clienteId)!.linhas.push(m);

    const dia = serie.get(m.data) ?? { data: m.data, gasto: 0, receita: 0, conversoes: 0 };
    dia.gasto += m.gasto;
    dia.receita += m.receita;
    dia.conversoes += m.conversoes;
    serie.set(m.data, dia);
  }

  const porCampanha: ResumoPorCampanha[] = campanhas
    .map((c) => ({
      campanhaId: c.id,
      nome: c.nome,
      status: c.status,
      clienteId: c.clienteId,
      clienteNome: c.clienteNome,
      resumo: resumirLinhas(totaisPorCampanha.get(c.id) ?? []),
    }))
    .sort((a, b) => b.resumo.gasto - a.resumo.gasto || a.nome.localeCompare(b.nome));

  const porCliente: ResumoPorCliente[] = [...totaisPorCliente.entries()]
    .map(([clienteId, { nome, linhas }]) => ({ clienteId, nome, resumo: resumirLinhas(linhas) }))
    .sort((a, b) => b.resumo.gasto - a.resumo.gasto || a.nome.localeCompare(b.nome));

  return {
    periodo,
    periodoAnterior,
    geral: comparar(resumirLinhas(validasAtual), resumirLinhas(validasAnterior)),
    serie: [...serie.values()]
      .map((d) => ({ ...d, gasto: arred(d.gasto, 2), receita: arred(d.receita, 2) }))
      .sort((a, b) => a.data.localeCompare(b.data)),
    porCliente,
    porCampanha,
  };
}

// ----- Query da rota -----

/** Query de `GET /metricas/dashboard` — janela e filtro opcional por cliente. */
export const dashboardQuerySchema = z.object({
  dias: z.coerce.number().int().min(1).max(90).default(30),
  cliente_id: uuidSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
