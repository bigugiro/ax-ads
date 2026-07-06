/** Estratégias (Sprint 4) — a feature de destaque (Seção 6 do plano).
 *  Jornada: Analisar (catálogo filtrável) → Detalhe (passos/guardrails/KPI) →
 *  Incluir ("Aplicar nesta conta") → Acompanhar (checklist + resultado medido). */
import type {
  Cliente,
  Estrategia,
  EstrategiaAplicadaComContexto,
  ImpactoEstrategia,
  StatusEstrategiaAplicada,
} from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiGet, ApiError, apiPatch, apiPost } from '../lib/api';
import { fmtMoedaExata, fmtRoas } from '../lib/format';

type Aba = 'catalogo' | 'aplicadas';
type FiltroCanal = 'todos' | Estrategia['canal'];
type FiltroNivel = 'todos' | Estrategia['nivel'];

const IMPACTO_INFO: Record<ImpactoEstrategia, { label: string; cor: string }> = {
  cac_down: { label: '↓ CAC', cor: 'bg-warning/20 text-warning' },
  roas_up: { label: '↑ ROAS', cor: 'bg-success/15 text-success' },
  faturamento_up: { label: '↑ Faturamento', cor: 'bg-success/15 text-success' },
};

const STATUS_APLICADA_INFO: Record<StatusEstrategiaAplicada, { label: string; cor: string }> = {
  analisando: { label: 'Analisando', cor: 'bg-muted/15 text-muted' },
  aplicada: { label: 'Aplicada', cor: 'bg-success/15 text-success' },
  pausada: { label: 'Pausada', cor: 'bg-warning/20 text-warning' },
  concluida: { label: 'Concluída', cor: 'bg-accent/15 text-accent' },
};

export function EstrategiasPage() {
  const [aba, setAba] = useState<Aba>('catalogo');
  const [clienteId, setClienteId] = useState<string>('');

  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiGet<Cliente[]>('/clientes'),
  });

  // Seleciona o primeiro cliente automaticamente assim que a lista chega.
  const clientes = clientesQuery.data ?? [];
  if (!clienteId && clientes.length > 0) setClienteId(clientes[0]!.id);

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <h1 id="page-title" className="font-display text-2xl font-extrabold">
          Estratégias
        </h1>
        <p className="text-sm text-muted">Padrões comprovados — analise, aplique, acompanhe.</p>
      </div>

      <SeletorCliente clientes={clientes} value={clienteId} onChange={setClienteId} />

      <div
        role="tablist"
        aria-label="Seção"
        className="flex rounded-xl border border-line bg-surface p-0.5"
      >
        <button
          role="tab"
          aria-selected={aba === 'catalogo'}
          onClick={() => setAba('catalogo')}
          className={`min-h-touch flex-1 rounded-lg text-sm font-semibold transition ${
            aba === 'catalogo' ? 'bg-brand text-brand-fg' : 'text-muted'
          }`}
        >
          Catálogo
        </button>
        <button
          role="tab"
          aria-selected={aba === 'aplicadas'}
          onClick={() => setAba('aplicadas')}
          className={`min-h-touch flex-1 rounded-lg text-sm font-semibold transition ${
            aba === 'aplicadas' ? 'bg-brand text-brand-fg' : 'text-muted'
          }`}
        >
          Aplicadas
        </button>
      </div>

      {aba === 'catalogo' ? (
        <Catalogo clienteId={clienteId} />
      ) : (
        <Aplicadas clienteId={clienteId} />
      )}
    </section>
  );
}

function SeletorCliente({
  clientes,
  value,
  onChange,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (clientes.length === 0) return null;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">Cliente</span>
      <select
        className="field text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Cliente"
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

// ----- Catálogo -----

function Catalogo({ clienteId }: { clienteId: string }) {
  const [canal, setCanal] = useState<FiltroCanal>('todos');
  const [nivel, setNivel] = useState<FiltroNivel>('todos');
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (canal !== 'todos') params.set('canal', canal);
  if (nivel !== 'todos') params.set('nivel', nivel);
  const qs = params.toString();

  const { data, isPending, isError } = useQuery({
    queryKey: ['estrategias', canal, nivel],
    queryFn: () => apiGet<Estrategia[]>(`/estrategias${qs ? `?${qs}` : ''}`),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FiltroChips
          rotulo="Canal"
          opcoes={[
            { valor: 'todos', label: 'Todos' },
            { valor: 'meta', label: 'Meta' },
            { valor: 'google', label: 'Google' },
            { valor: 'ambos', label: 'Ambos' },
          ]}
          value={canal}
          onChange={(v) => setCanal(v)}
        />
        <FiltroChips
          rotulo="Nível"
          opcoes={[
            { valor: 'todos', label: 'Todos' },
            { valor: 'iniciante', label: 'Iniciante' },
            { valor: 'avancado', label: 'Avançado' },
          ]}
          value={nivel}
          onChange={(v) => setNivel(v)}
        />
      </div>

      {isPending && <Esqueleto />}
      {isError && (
        <div role="alert" className="card border-danger/30 text-sm text-danger">
          Não rolou carregar o catálogo. Tenta de novo.
        </div>
      )}
      {data && data.length === 0 && (
        <div className="card text-center text-sm text-content-2">
          Nenhuma estratégia com esse filtro. Bora tentar outro?
        </div>
      )}
      {data && (
        <ul className="space-y-2">
          {data.map((e) => (
            <EstrategiaCard
              key={e.id}
              estrategia={e}
              aberta={abertaId === e.id}
              onToggle={() => setAbertaId(abertaId === e.id ? null : e.id)}
              clienteId={clienteId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FiltroChips<T extends string>({
  rotulo,
  opcoes,
  value,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={value === o.valor}
          className={`min-h-touch rounded-full border px-3 text-xs font-semibold transition ${
            value === o.valor
              ? 'border-brand bg-brand text-brand-fg'
              : 'border-line bg-surface text-content-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EstrategiaCard({
  estrategia,
  aberta,
  onToggle,
  clienteId,
}: {
  estrategia: Estrategia;
  aberta: boolean;
  onToggle: () => void;
  clienteId: string;
}) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const aplicar = useMutation({
    mutationFn: () =>
      apiPost<EstrategiaAplicadaComContexto>(
        `/clientes/${clienteId}/estrategias/${estrategia.id}/aplicar`,
      ),
    onSuccess: () => {
      setErro(null);
      setSucesso(true);
      void qc.invalidateQueries({ queryKey: ['estrategias-aplicadas', clienteId] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <li className="card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 text-left"
        aria-expanded={aberta}
      >
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold text-content">{estrategia.titulo}</p>
          <p className="text-xs text-content-2">{estrategia.categoria}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted">{aberta ? '▲' : '▼'}</span>
      </button>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
          {estrategia.canal}
        </span>
        <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
          {estrategia.nivel}
        </span>
        {estrategia.impacto.map((i) => (
          <span
            key={i}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${IMPACTO_INFO[i].cor}`}
          >
            {IMPACTO_INFO[i].label}
          </span>
        ))}
      </div>

      {aberta && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Quando usar</p>
            <p className="text-sm text-content">{estrategia.quando_usar}</p>
          </div>

          {estrategia.pre_requisitos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Pré-requisitos</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-content">
                {estrategia.pre_requisitos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase text-muted">Passos</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-content">
              {estrategia.passos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>

          {estrategia.guardrails.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Guardrails</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-content">
                {estrategia.guardrails.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase text-muted">KPI de sucesso</p>
            <p className="text-sm text-content">{estrategia.kpi_sucesso}</p>
          </div>

          {sucesso ? (
            <p className="text-sm font-semibold text-success">
              Aplicada — acompanhe na aba &quot;Aplicadas&quot;.
            </p>
          ) : (
            <button
              type="button"
              className="btn-brand w-full"
              onClick={() => aplicar.mutate()}
              disabled={aplicar.isPending || !clienteId}
            >
              {aplicar.isPending ? 'Aplicando…' : 'Aplicar nesta conta'}
            </button>
          )}
          {erro && (
            <p role="alert" className="text-xs text-danger">
              {erro}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ----- Aplicadas -----

function Aplicadas({ clienteId }: { clienteId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['estrategias-aplicadas', clienteId],
    queryFn: () =>
      apiGet<EstrategiaAplicadaComContexto[]>(`/clientes/${clienteId}/estrategias-aplicadas`),
    enabled: Boolean(clienteId),
  });

  if (!clienteId) return null;
  if (isPending) return <Esqueleto />;
  if (isError) {
    return (
      <div role="alert" className="card border-danger/30 text-sm text-danger">
        Não rolou carregar as estratégias aplicadas. Tenta de novo.
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">🚀</p>
        <p className="font-display text-lg font-extrabold">Nenhuma estratégia aplicada ainda</p>
        <p className="text-sm text-content-2">
          Vai no catálogo, escolhe uma e aperta &quot;Aplicar nesta conta&quot;.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((a) => (
        <AplicadaCard key={a.id} aplicada={a} clienteId={clienteId} />
      ))}
    </ul>
  );
}

function AplicadaCard({
  aplicada,
  clienteId,
}: {
  aplicada: EstrategiaAplicadaComContexto;
  clienteId: string;
}) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ['estrategias-aplicadas', clienteId] });

  const mudarStatus = useMutation({
    mutationFn: (status: StatusEstrategiaAplicada) =>
      apiPatch(`/estrategias-aplicadas/${aplicada.id}`, { status }),
    onSuccess: invalidar,
  });

  const marcarItem = useMutation({
    mutationFn: ({ id, feito }: { id: string; feito: boolean }) =>
      apiPatch(`/estrategia-checklist/${id}`, { feito }),
    onSuccess: invalidar,
  });

  const info = STATUS_APLICADA_INFO[aplicada.status];
  const pct =
    aplicada.checklist.total > 0 ? aplicada.checklist.feitos / aplicada.checklist.total : 0;

  const resultado = useMemo(() => {
    const r = aplicada.resultado as {
      baseline?: { roas: number | null; cpa: number | null };
    } | null;
    return r?.baseline ?? null;
  }, [aplicada.resultado]);

  return (
    <li className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-extrabold text-content">
          {aplicada.estrategia_titulo}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${info.cor}`}
        >
          {info.label}
        </span>
      </div>

      {/* Checklist */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
          <span>Checklist</span>
          <span>
            {aplicada.checklist.feitos}/{aplicada.checklist.total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct * 100}%` }} />
        </div>
        <ul className="mt-2 space-y-1.5">
          {aplicada.checklist.itens.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand focus:ring-brand"
                checked={item.feito}
                onChange={(e) => marcarItem.mutate({ id: item.id, feito: e.target.checked })}
                aria-label={item.descricao}
              />
              <span
                className={`text-sm ${item.feito ? 'text-muted line-through' : 'text-content'}`}
              >
                {item.descricao}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Resultado medido */}
      {resultado && (
        <div className="rounded-xl bg-bg p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-muted">
            Resultado vs. ao aplicar
          </p>
          <div className="flex gap-4 text-sm">
            <span>
              ROAS: <b className="text-brand">{fmtRoas(resultado.roas)}</b> →{' '}
              <b className="text-brand">{fmtRoas(aplicada.atual?.roas ?? null)}</b>
            </span>
            <span>
              CAC: <b>{fmtMoedaExata(resultado.cpa)}</b> →{' '}
              <b>{fmtMoedaExata(aplicada.atual?.cpa ?? null)}</b>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">Meta: {aplicada.estrategia_kpi_sucesso}</p>
        </div>
      )}

      {/* Ações de status */}
      <div className="flex gap-2">
        {aplicada.status === 'aplicada' && (
          <>
            <button
              type="button"
              className="btn-ghost flex-1 text-sm"
              onClick={() => mudarStatus.mutate('pausada')}
              disabled={mudarStatus.isPending}
            >
              Pausar
            </button>
            <button
              type="button"
              className="btn-ghost flex-1 text-sm"
              onClick={() => mudarStatus.mutate('concluida')}
              disabled={mudarStatus.isPending}
            >
              Concluir
            </button>
          </>
        )}
        {aplicada.status === 'pausada' && (
          <button
            type="button"
            className="btn-brand flex-1 text-sm"
            onClick={() => mudarStatus.mutate('aplicada')}
            disabled={mudarStatus.isPending}
          >
            Reativar
          </button>
        )}
      </div>
    </li>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card h-20 animate-pulse bg-line/40" />
      ))}
    </div>
  );
}
