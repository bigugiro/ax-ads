/** Dashboard mobile (Sprint 2): KPIs de ROAS/CAC/CPA/CTR com comparação,
 *  série diária e quebra por cliente e campanha. Mobile-first. */
import type { DashboardMetricas } from '@ax-ads/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KpiCard, MiniSerie, StatusChip } from '../components/dashboard';
import { apiGet } from '../lib/api';
import { fmtInteiro, fmtMoeda, fmtMoedaExata, fmtPct, fmtRoas } from '../lib/format';

const PERIODOS = [
  { dias: 7, rotulo: '7d' },
  { dias: 30, rotulo: '30d' },
  { dias: 90, rotulo: '90d' },
] as const;

export function DashboardPage() {
  const [dias, setDias] = useState<number>(30);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['dashboard', dias],
    queryFn: () => apiGet<DashboardMetricas>(`/metricas/dashboard?dias=${dias}`),
  });

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 id="page-title" className="text-xl font-bold">
            Dashboard
          </h1>
          <p className="text-sm text-muted">Performance dos últimos {dias} dias</p>
        </div>
        <div
          role="tablist"
          aria-label="Período"
          className="flex rounded-xl border border-line bg-surface p-0.5"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              role="tab"
              aria-selected={dias === p.dias}
              onClick={() => setDias(p.dias)}
              className={`min-h-touch rounded-lg px-3 text-sm font-semibold transition ${
                dias === p.dias ? 'bg-brand text-brand-fg' : 'text-muted'
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </header>

      {isPending && <Esqueleto />}
      {isError && (
        <div role="alert" className="card border-danger/30 text-sm text-danger">
          Não foi possível carregar as métricas: {error.message}
        </div>
      )}
      {data && <Conteudo data={data} />}
    </section>
  );
}

function Conteudo({ data }: { data: DashboardMetricas }) {
  const { geral, serie, porCliente, porCampanha } = data;
  const contaConectada = porCampanha.length > 0;

  if (!contaConectada) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">📊</p>
        <p className="font-semibold">Nenhuma conta conectada ainda</p>
        <p className="text-sm text-muted">
          Conecte uma conta de anúncios a um cliente para ver ROAS, CAC e CPA aqui.
        </p>
      </div>
    );
  }

  const { atual, variacao } = geral;

  return (
    <div className="space-y-5">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          rotulo="ROAS"
          valor={fmtRoas(atual.roas)}
          variacao={variacao.roas}
          sentido="maisMelhor"
          destaque
        />
        <KpiCard
          rotulo="CAC / CPA"
          valor={fmtMoedaExata(atual.cpa)}
          variacao={variacao.cpa}
          sentido="menosMelhor"
        />
        <KpiCard
          rotulo="CTR"
          valor={fmtPct(atual.ctr)}
          variacao={variacao.ctr}
          sentido="maisMelhor"
        />
        <KpiCard
          rotulo="Receita"
          valor={fmtMoeda(atual.receita)}
          variacao={variacao.receita}
          sentido="maisMelhor"
        />
        <KpiCard
          rotulo="Gasto"
          valor={fmtMoeda(atual.gasto)}
          variacao={variacao.gasto}
          sentido="neutro"
        />
        <KpiCard
          rotulo="Conversões"
          valor={fmtInteiro(atual.conversoes)}
          variacao={variacao.conversoes}
          sentido="maisMelhor"
        />
      </div>

      {/* Série diária */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Receita × Gasto por dia</h2>
        <MiniSerie serie={serie} />
      </div>

      {/* Por cliente */}
      <section aria-labelledby="por-cliente">
        <h2 id="por-cliente" className="mb-2 text-sm font-semibold">
          Por cliente
        </h2>
        <ul className="space-y-2">
          {porCliente.map((c) => (
            <li key={c.clienteId} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.nome}</p>
                <p className="text-xs text-muted">
                  Gasto {fmtMoeda(c.resumo.gasto)} · Receita {fmtMoeda(c.resumo.receita)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums">{fmtRoas(c.resumo.roas)}</p>
                <p className="text-[11px] text-muted">ROAS</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Por campanha */}
      <section aria-labelledby="por-campanha">
        <h2 id="por-campanha" className="mb-2 text-sm font-semibold">
          Por campanha
        </h2>
        <ul className="space-y-2">
          {porCampanha.map((c) => (
            <li key={c.campanhaId} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="text-xs text-muted">{c.clienteNome}</p>
                </div>
                <StatusChip status={c.status} />
              </div>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                <Metrica rotulo="ROAS" valor={fmtRoas(c.resumo.roas)} />
                <Metrica rotulo="CPA" valor={fmtMoedaExata(c.resumo.cpa)} />
                <Metrica rotulo="CTR" valor={fmtPct(c.resumo.ctr, 1)} />
                <Metrica rotulo="Gasto" valor={fmtMoeda(c.resumo.gasto)} />
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dd className="text-sm font-bold tabular-nums">{valor}</dd>
      <dt className="text-[10px] uppercase text-muted">{rotulo}</dt>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-20 animate-pulse bg-line/40" />
        ))}
      </div>
      <div className="card h-24 animate-pulse bg-line/40" />
    </div>
  );
}
