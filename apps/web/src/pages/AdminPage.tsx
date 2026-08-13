/** Admin mínimo do operador do SaaS (Sprint 10) — cross-tenant, só visível
 *  (e só autorizado no backend) pra `usuarios.super_admin = true`. */
import type { AgenciaAdmin, StatusTenant } from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPatch, ApiError } from '../lib/api';

const ROTULO_STATUS: Record<StatusTenant, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  suspenso: 'Suspenso',
};
const COR_STATUS: Record<StatusTenant, string> = {
  ativo: 'bg-success/15 text-success',
  inativo: 'bg-muted/15 text-muted',
  suspenso: 'bg-danger/15 text-danger',
};

export function AdminPage() {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-agencias'],
    queryFn: () => apiGet<AgenciaAdmin[]>('/admin/agencias'),
  });

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusTenant }) =>
      apiPatch<AgenciaAdmin>(`/admin/agencias/${id}`, { status }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['admin-agencias'] });
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
          Admin
        </h1>
        <p className="text-sm text-muted">Todas as agências da plataforma (cross-tenant).</p>
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {isPending ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma agência ainda.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-content">{a.nome}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${COR_STATUS[a.status]}`}
                >
                  {ROTULO_STATUS[a.status]}
                </span>
              </div>
              <p className="text-xs text-content-2">
                Plano {a.plano} · assinatura {a.assinatura_status ?? 'nenhuma'}
              </p>
              <div className="flex gap-2 pt-1">
                {a.status !== 'suspenso' && (
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    disabled={mudarStatus.isPending}
                    onClick={() => mudarStatus.mutate({ id: a.id, status: 'suspenso' })}
                  >
                    Suspender
                  </button>
                )}
                {a.status !== 'ativo' && (
                  <button
                    type="button"
                    className="btn-brand flex-1"
                    disabled={mudarStatus.isPending}
                    onClick={() => mudarStatus.mutate({ id: a.id, status: 'ativo' })}
                  >
                    Reativar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
