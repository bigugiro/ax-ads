/** Assinatura (Sprint 9): status do plano, trocar de plano e cancelar.
 *  Escrita exige `gerenciar_billing` (owner) — o backend garante, aqui só
 *  mostramos a mensagem de erro se o papel não permitir. */
import type { Assinatura, Plano } from '@ax-ads/shared';
import { formatarPrecoPlano } from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../lib/api';

const PLANOS: Plano[] = ['starter', 'pro', 'agency'];

const ROTULO_STATUS: Record<Assinatura['status'], string> = {
  trialing: 'Em teste',
  ativa: 'Ativa',
  inadimplente: 'Inadimplente',
  cancelada: 'Cancelada',
};

const COR_STATUS: Record<Assinatura['status'], string> = {
  trialing: 'bg-accent/15 text-accent',
  ativa: 'bg-success/15 text-success',
  inadimplente: 'bg-warning/15 text-warning',
  cancelada: 'bg-danger/15 text-danger',
};

export function AssinaturaPage() {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const { data: assinatura, isPending } = useQuery({
    queryKey: ['assinatura'],
    queryFn: () => apiGet<Assinatura | null>('/assinatura'),
  });

  const trocarPlano = useMutation({
    mutationFn: (plano: Plano) => apiPost<Assinatura>('/billing/checkout', { plano }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['assinatura'] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  const cancelar = useMutation({
    mutationFn: () => apiPost<Assinatura>('/billing/cancelar'),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['assinatura'] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <Link to="/mais" className="text-sm font-medium text-brand">
          ← Mais
        </Link>
        <h1 id="page-title" className="mt-1 font-display text-2xl font-extrabold">
          Assinatura
        </h1>
        <p className="text-sm text-muted">Plano da agência, trocar ou cancelar.</p>
      </div>

      <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
        Provider placeholder (demo) — troca de plano ativa na hora, sem cobrança real ainda.
      </p>

      {isPending ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : assinatura ? (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-extrabold capitalize text-content">
              {assinatura.plano}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${COR_STATUS[assinatura.status]}`}
            >
              {ROTULO_STATUS[assinatura.status]}
            </span>
          </div>
          <p className="text-sm text-content-2">{formatarPrecoPlano(assinatura.plano)}/mês</p>
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhuma assinatura ainda.</p>
      )}

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <div className="card space-y-2">
        <p className="text-xs font-semibold uppercase text-muted">Trocar de plano</p>
        <div className="grid grid-cols-3 gap-2">
          {PLANOS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={trocarPlano.isPending || assinatura?.plano === p}
              onClick={() => trocarPlano.mutate(p)}
              className={`rounded-xl border p-2.5 text-center capitalize transition disabled:opacity-50 ${
                assinatura?.plano === p
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-line text-content-2'
              }`}
            >
              <p className="text-sm font-bold">{p}</p>
              <p className="text-[11px]">{formatarPrecoPlano(p)}/mês</p>
            </button>
          ))}
        </div>
      </div>

      {assinatura && assinatura.status !== 'cancelada' && (
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={cancelar.isPending}
          onClick={() => cancelar.mutate()}
        >
          {cancelar.isPending ? 'Cancelando…' : 'Cancelar assinatura'}
        </button>
      )}
    </section>
  );
}
