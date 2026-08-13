/** PDCA / Otimização (Sprint 7): anomalias detectadas e recomendações
 *  para aprovar, aplicar ou rejeitar. Acessível pela aba Mais. */
import type {
  AnomaliaComContexto,
  Cliente,
  RecomendacaoComContexto,
  StatusRecomendacao,
} from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, ApiError, apiPatch } from '../lib/api';

const ROTULO_SEVERIDADE: Record<AnomaliaComContexto['severidade'], string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const COR_SEVERIDADE: Record<AnomaliaComContexto['severidade'], string> = {
  baixa: 'bg-muted/15 text-muted',
  media: 'bg-warning/15 text-warning',
  alta: 'bg-danger/15 text-danger',
};

const ROTULO_STATUS: Record<StatusRecomendacao, string> = {
  sugerida: 'Sugerida',
  aprovada: 'Aprovada',
  aplicada: 'Aplicada',
  rejeitada: 'Rejeitada',
};

export function PdcaPage() {
  const [aba, setAba] = useState<'recomendacoes' | 'anomalias'>('recomendacoes');
  const [clienteId, setClienteId] = useState('');

  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiGet<Cliente[]>('/clientes'),
  });
  const clientes = clientesQuery.data ?? [];
  if (!clienteId && clientes.length > 0) setClienteId(clientes[0]!.id);

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <Link to="/mais" className="text-sm font-medium text-brand">
          ← Mais
        </Link>
        <h1 id="page-title" className="mt-1 font-display text-2xl font-extrabold">
          PDCA / Otimização
        </h1>
        <p className="text-sm text-muted">
          Anomalias de CPA/ROAS e recomendações do motor de melhoria contínua.
        </p>
      </div>

      {clientes.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Cliente</span>
          <select
            className="field text-sm"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            aria-label="Cliente"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        role="tablist"
        aria-label="Seção"
        className="flex rounded-xl border border-line bg-surface p-0.5"
      >
        {(['recomendacoes', 'anomalias'] as const).map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`min-h-touch flex-1 rounded-lg text-sm font-semibold capitalize transition ${
              aba === a ? 'bg-brand text-brand-fg' : 'text-muted'
            }`}
          >
            {a === 'anomalias' ? 'Anomalias' : 'Recomendações'}
          </button>
        ))}
      </div>

      {clienteId &&
        (aba === 'recomendacoes' ? (
          <Recomendacoes clienteId={clienteId} />
        ) : (
          <Anomalias clienteId={clienteId} />
        ))}
    </section>
  );
}

function Recomendacoes({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['recomendacoes', clienteId],
    queryFn: () => apiGet<RecomendacaoComContexto[]>(`/clientes/${clienteId}/recomendacoes`),
  });

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusRecomendacao }) =>
      apiPatch(`/recomendacoes/${id}`, { status }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['recomendacoes', clienteId] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  if (isPending) return <p className="text-sm text-muted">Carregando…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted">Nenhuma recomendação por aqui ainda.</p>;

  return (
    <div className="space-y-3">
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.id} className="card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-content">{r.alvo_entidade}</span>
              <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {ROTULO_STATUS[r.status]}
              </span>
            </div>
            <p className="text-sm text-content-2">{r.descricao}</p>
            <p className="text-xs text-muted">Impacto estimado: {r.impacto_estimado}</p>
            {r.status === 'sugerida' && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn-brand flex-1"
                  disabled={mudarStatus.isPending}
                  onClick={() => mudarStatus.mutate({ id: r.id, status: 'aplicada' })}
                >
                  Aplicar
                </button>
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  disabled={mudarStatus.isPending}
                  onClick={() => mudarStatus.mutate({ id: r.id, status: 'rejeitada' })}
                >
                  Rejeitar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Anomalias({ clienteId }: { clienteId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['anomalias', clienteId],
    queryFn: () => apiGet<AnomaliaComContexto[]>(`/clientes/${clienteId}/anomalias`),
  });

  if (isPending) return <p className="text-sm text-muted">Carregando…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted">Nenhuma anomalia detectada ainda.</p>;

  return (
    <ul className="space-y-2">
      {data.map((a) => (
        <li key={a.id} className="card space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-content">{a.campanha_nome ?? '—'}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${COR_SEVERIDADE[a.severidade]}`}
            >
              {ROTULO_SEVERIDADE[a.severidade]}
            </span>
          </div>
          <p className="text-xs text-content-2">
            {a.metrica.toUpperCase()}: {a.valor.toFixed(2)} (esperado {a.esperado.toFixed(2)})
          </p>
          <p className="text-[11px] text-muted">
            {new Date(a.detectada_em).toLocaleString('pt-BR')}
          </p>
        </li>
      ))}
    </ul>
  );
}
