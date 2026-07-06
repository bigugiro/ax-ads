/** Peças visuais do painel (Sprint 2): KPI, badge de variação e mini-gráfico. */
import type { SerieDiaria } from '@ax-ads/shared';
import { fmtMoeda, fmtVariacao } from '../lib/format';

type Sentido = 'maisMelhor' | 'menosMelhor' | 'neutro';

/** Badge de variação em pílula, colorido pelo que é bom para o negócio. */
export function DeltaBadge({
  variacao,
  sentido,
  onHero = false,
}: {
  variacao: number | null;
  sentido: Sentido;
  onHero?: boolean;
}) {
  const texto = fmtVariacao(variacao);
  if (texto === null || variacao === null) {
    return (
      <span className={`text-[11px] font-medium ${onHero ? 'text-brand-fg/70' : 'text-muted'}`}>
        — sem base
      </span>
    );
  }

  const seta = variacao > 0 ? '▲' : variacao < 0 ? '▼' : '';
  const pill = 'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold';

  if (onHero) {
    return (
      <span className={`${pill} bg-brand-fg/20 text-brand-fg`}>
        {seta} {texto}
      </span>
    );
  }

  let cls = 'bg-muted/15 text-muted';
  if (sentido !== 'neutro' && variacao !== 0) {
    const bom =
      (variacao > 0 && sentido === 'maisMelhor') || (variacao < 0 && sentido === 'menosMelhor');
    cls = bom ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger';
  }
  return (
    <span className={`${pill} ${cls}`}>
      {seta} {texto}
    </span>
  );
}

/** Cartão de KPI. `hero`: card laranja cheio (número-herói). */
export function KpiCard({
  rotulo,
  valor,
  variacao,
  sentido,
  hero = false,
}: {
  rotulo: string;
  valor: string;
  variacao?: number | null;
  sentido?: Sentido;
  hero?: boolean;
}) {
  if (hero) {
    return (
      <div className="card border-transparent bg-brand text-brand-fg shadow-lg shadow-brand/25">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-fg/80">{rotulo}</p>
        <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{valor}</p>
        {variacao !== undefined && (
          <div className="mt-1.5">
            <DeltaBadge variacao={variacao} sentido={sentido ?? 'neutro'} onHero />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-content">{valor}</p>
      {variacao !== undefined && (
        <div className="mt-1.5">
          <DeltaBadge variacao={variacao} sentido={sentido ?? 'neutro'} />
        </div>
      )}
    </div>
  );
}

/**
 * Mini-gráfico: barras de receita (roxo/dado) com a linha de gasto (vermelho/
 * verba) sobreposta — a folga da barra sobre a linha é o lucro visível (ROAS
 * > 1). Responsivo (largura 100%).
 */
export function MiniSerie({ serie }: { serie: SerieDiaria[] }) {
  if (serie.length === 0) {
    return <p className="text-sm text-content-2">Sem dados no período.</p>;
  }

  const H = 80;
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
            rx={1.5}
            className="fill-accent"
          />
        ))}
        <polyline
          points={pontosGasto}
          fill="none"
          stroke="rgb(var(--danger))"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-content-2">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-accent" /> Receita
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-danger" /> Gasto
        </span>
        <span className="ml-auto font-medium tabular-nums">pico {fmtMoeda(max)}</span>
      </div>
    </div>
  );
}

/** Chip de status de entrega (ativa/pausada/arquivada). */
export function StatusChip({ status }: { status: string }) {
  const cor =
    status === 'ativa'
      ? 'bg-success/15 text-success'
      : status === 'pausada'
        ? 'bg-warning/20 text-warning'
        : 'bg-danger/15 text-danger';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cor}`}>
      {status}
    </span>
  );
}
