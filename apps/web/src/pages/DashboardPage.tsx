/** Dashboard mobile (Sprint 2): KPIs de ROAS/CAC/CPA/CTR com comparação,
 *  série diária e quebra por cliente e campanha. Mobile-first. */
import type { DashboardMetricas } from '@ax-ads/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
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

  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard', dias],
    queryFn: () => apiGet<DashboardMetricas>(`/metricas/dashboard?dias=${dias}`),
  });

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 id="page-title" className="font-display text-2xl font-extrabold">
            Dashboard
          </h1>
          <p className="text-sm text-muted">Como tá indo nos últimos {dias} dias</p>
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
          Não rolou carregar as métricas. Tenta de novo.
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
        <p className="text-3xl">🚀</p>
        <p className="font-display text-lg font-extrabold">Nenhuma conta por aqui ainda</p>
        <p className="text-sm text-content-2">
          Conecte a conta de um cliente e o ROAS, o CAC e o CPA aparecem aqui na hora. Bora plugar a
          primeira?
        </p>
      </div>
    );
  }

  const { atual, variacao } = geral;

  return (
    <div className="space-y-6">
      {/* ROAS — número-herói (card laranja cheio) */}
      <KpiCard
        rotulo="ROAS no período"
        valor={fmtRoas(atual.roas)}
        variacao={variacao.roas}
        sentido="maisMelhor"
        hero
      />

      {/* Demais KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
          rotulo="Conversões"
          valor={fmtInteiro(atual.conversoes)}
          variacao={variacao.conversoes}
          sentido="maisMelhor"
        />
      </div>

      {/* Série diária */}
      <div className="card">
        <h2 className="mb-3 font-display text-base font-extrabold">Receita × gasto por dia</h2>
        <MiniSerie serie={serie} />
      </div>

      {/* Por cliente */}
      <section aria-labelledby="por-cliente">
        <SecaoTitulo id="por-cliente">Por cliente</SecaoTitulo>
        <ul className="space-y-2">
          {porCliente.map((c) => (
            <li
              key={c.clienteId}
              className="card flex items-center justify-between gap-3 border-l-4 border-l-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-content">{c.nome}</p>
                <p className="text-xs text-content-2">
                  Gasto {fmtMoeda(c.resumo.gasto)} · Receita {fmtMoeda(c.resumo.receita)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-extrabold tabular-nums text-brand">
                  {fmtRoas(c.resumo.roas)}
                </p>
                <p className="text-[11px] font-medium text-muted">ROAS</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Por campanha */}
      <section aria-labelledby="por-campanha">
        <SecaoTitulo id="por-campanha">Por campanha</SecaoTitulo>
        <ul className="space-y-2">
          {porCampanha.map((c) => (
            <li key={c.campanhaId} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-content">{c.nome}</p>
                  <p className="text-xs text-content-2">{c.clienteNome}</p>
                </div>
                <StatusChip status={c.status} />
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Metrica rotulo="ROAS" valor={fmtRoas(c.resumo.roas)} destaque />
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

/** Título de seção com marcador laranja (BRAND.md §7). */
function SecaoTitulo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
      <span className="h-4 w-1.5 rounded-full bg-brand" />
      {children}
    </h2>
  );
}

function Metrica({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <dd
        className={`font-display text-base font-extrabold tabular-nums ${
          destaque ? 'text-brand' : 'text-content'
        }`}
      >
        {valor}
      </dd>
      <dt className="text-[10px] font-medium uppercase text-muted">{rotulo}</dt>
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
