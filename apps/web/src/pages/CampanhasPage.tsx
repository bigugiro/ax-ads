/** Campanhas (Sprint 3): listar por cliente e operar — pausar/ativar e ajustar
 *  budget via AdsProvider. Mobile-first. */
import type { AtualizarCampanha, CampanhaComContexto } from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StatusChip } from '../components/dashboard';
import { apiGet, ApiError, apiPatch } from '../lib/api';
import { fmtMoeda } from '../lib/format';

export function CampanhasPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['campanhas'],
    queryFn: () => apiGet<CampanhaComContexto[]>('/campanhas'),
  });

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <h1 id="page-title" className="font-display text-2xl font-extrabold">
          Campanhas
        </h1>
        <p className="text-sm text-muted">Pausa, reativa e ajusta o orçamento na hora.</p>
      </div>

      {isPending && <Esqueleto />}
      {isError && (
        <div role="alert" className="card border-danger/30 text-sm text-danger">
          Não rolou carregar as campanhas. Tenta de novo.
        </div>
      )}
      {data && (data.length === 0 ? <Vazio /> : <Lista campanhas={data} />)}
    </section>
  );
}

function Lista({ campanhas }: { campanhas: CampanhaComContexto[] }) {
  // Agrupa por cliente, preservando a ordem (já vem por budget desc).
  const grupos = new Map<string, CampanhaComContexto[]>();
  for (const c of campanhas) {
    const lista = grupos.get(c.cliente_nome) ?? [];
    lista.push(c);
    grupos.set(c.cliente_nome, lista);
  }

  return (
    <div className="space-y-5">
      {[...grupos.entries()].map(([cliente, itens]) => (
        <section key={cliente} aria-label={cliente}>
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
            <span className="h-4 w-1.5 rounded-full bg-brand" />
            {cliente}
          </h2>
          <ul className="space-y-2">
            {itens.map((c) => (
              <CampanhaCard key={c.id} campanha={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CampanhaCard({ campanha }: { campanha: CampanhaComContexto }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [valorBudget, setValorBudget] = useState(String(campanha.budget));
  const [erro, setErro] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: (patch: AtualizarCampanha) =>
      apiPatch<CampanhaComContexto>(`/campanhas/${campanha.id}`, patch),
    onSuccess: () => {
      setErro(null);
      setEditando(false);
      void qc.invalidateQueries({ queryKey: ['campanhas'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  const operavel = campanha.status === 'ativa' || campanha.status === 'pausada';
  const proximoStatus = campanha.status === 'ativa' ? 'pausada' : 'ativa';

  function salvarBudget() {
    const n = Number(valorBudget.replace(',', '.'));
    if (!(n > 0)) {
      setErro('Orçamento tem que ser maior que zero.');
      return;
    }
    mutacao.mutate({ budget: n });
  }

  return (
    <li className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">{campanha.nome}</p>
          <p className="text-xs text-content-2">{campanha.objetivo}</p>
        </div>
        <StatusChip status={campanha.status} />
      </div>

      {/* Orçamento */}
      <div className="mt-3 flex items-center justify-between gap-3">
        {editando ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                autoFocus
                value={valorBudget}
                onChange={(e) => setValorBudget(e.target.value)}
                className="field !min-h-[40px] pl-9 text-sm"
                aria-label="Novo orçamento"
              />
            </div>
            <button
              type="button"
              className="btn-brand !min-h-[40px] px-3 text-sm"
              onClick={salvarBudget}
              disabled={mutacao.isPending}
            >
              {mutacao.isPending ? '…' : 'Salvar'}
            </button>
            <button
              type="button"
              className="btn-ghost !min-h-[40px] px-3 text-sm"
              onClick={() => {
                setEditando(false);
                setValorBudget(String(campanha.budget));
                setErro(null);
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <p className="font-display text-lg font-extrabold tabular-nums text-content">
              {fmtMoeda(campanha.budget)}
              <span className="ml-1 text-xs font-medium text-muted">
                {campanha.budget_tipo === 'diario' ? 'por dia' : 'total'}
              </span>
            </p>
            <button
              type="button"
              className="btn-ghost !min-h-[40px] px-3 text-sm"
              onClick={() => setEditando(true)}
            >
              Editar budget
            </button>
          </>
        )}
      </div>

      {/* Pausar/ativar */}
      {operavel && !editando && (
        <button
          type="button"
          className="btn-ghost mt-2 w-full text-sm"
          onClick={() => mutacao.mutate({ status: proximoStatus })}
          disabled={mutacao.isPending}
        >
          {campanha.status === 'ativa' ? 'Pausar campanha' : 'Reativar campanha'}
        </button>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {erro}
        </p>
      )}
    </li>
  );
}

function Vazio() {
  return (
    <div className="card space-y-2 text-center">
      <p className="text-3xl">🚀</p>
      <p className="font-display text-lg font-extrabold">Nenhuma campanha ainda</p>
      <p className="text-sm text-content-2">
        Conecte a conta de um cliente que as campanhas aparecem aqui pra você operar.
      </p>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-line/40" />
      ))}
    </div>
  );
}
