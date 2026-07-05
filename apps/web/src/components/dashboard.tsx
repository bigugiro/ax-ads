/** Peças visuais do painel (Sprint 2): KPI, badge de variação e mini-gráfico. */
import type { SerieDiaria } from '@ax-ads/shared';
import { fmtMoeda, fmtVariacao } from '../lib/format';

type Sentido = 'maisMelhor' | 'menosMelhor' | 'neutro';

/** Badge de variação período-a-período, colorido pelo que é bom para o negócio. */
export function DeltaBadge({ variacao, sentido }: { variacao: number | null; sentido: Sentido }) {
  const texto = fmtVariacao(variacao);
  if (texto === null || variacao === null) {
    return <span className="text-[11px] font-medium text-muted">— sem base</span>;
  }

  let cor = 'text-muted';
  if (sentido !== 'neutro' && variacao !== 0) {
    const bom =
      (variacao > 0 && sentido === 'maisMelhor') || (variacao < 0 && sentido === 'menosMelhor');
    cor = bom ? 'text-success' : 'text-danger';
  }
  const seta = variacao > 0 ? '▲' : variacao < 0 ? '▼' : '';
  return (
    <span className={`text-[11px] font-semibold ${cor}`}>
      {seta} {texto}
    </span>
  );
}

/** Cartão de KPI: rótulo, valor grande e variação. */
export function KpiCard({
  rotulo,
  valor,
  variacao,
  sentido,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  variacao?: number | null;
  sentido?: Sentido;
  destaque?: boolean;
}) {
  return (
    <div className={`card ${destaque ? 'ring-1 ring-brand/30' : ''}`}>
      <p className="text-xs font-medium text-muted">{rotulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
      {variacao !== undefined && (
        <div className="mt-1">
          <DeltaBadge variacao={variacao} sentido={sentido ?? 'neutro'} />
        </div>
      )}
    </div>
  );
}

/**
 * Mini-gráfico: barras de receita com a linha de gasto sobreposta — a folga da
 * barra sobre a linha é o lucro visível (ROAS > 1). Responsivo (largura 100%).
 */
export function MiniSerie({ serie }: { serie: SerieDiaria[] }) {
  if (serie.length === 0) {
    return <p className="text-sm text-muted">Sem dados no período.</p>;
  }

  const H = 64;
  const passo = 6;
  const larguraBarra = 4;
  const W = Math.max(serie.length * passo, passo);
  const max = Math.max(1, ...serie.map((d) => Math.max(d.receita, d.gasto)));
  const y = (v: number) => H - (v / max) * H;

  const pontosGasto = serie
    .map((d, i) => `${i * passo + larguraBarra / 2},${y(d.gasto).toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="Receita (barras) e gasto (linha) por dia no período"
      >
        {serie.map((d, i) => (
          <rect
            key={d.data}
            x={i * passo}
            y={y(d.receita)}
            width={larguraBarra}
            height={H - y(d.receita)}
            rx={1}
            className="fill-brand/70"
          />
        ))}
        <polyline
          points={pontosGasto}
          fill="none"
          stroke="rgb(var(--danger))"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-brand/70" /> Receita
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-danger" /> Gasto
        </span>
        <span className="ml-auto tabular-nums">pico {fmtMoeda(max)}</span>
      </div>
    </div>
  );
}

/** Chip de status de entrega (ativa/pausada/arquivada). */
export function StatusChip({ status }: { status: string }) {
  const cor =
    status === 'ativa'
      ? 'bg-success/10 text-success'
      : status === 'pausada'
        ? 'bg-muted/15 text-muted'
        : 'bg-danger/10 text-danger';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cor}`}>
      {status}
    </span>
  );
}
