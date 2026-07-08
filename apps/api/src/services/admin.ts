/**
 * Admin mínimo do operador do SaaS (Sprint 10) — cross-tenant, SEMPRE via
 * service role (o propósito da rota é enxergar todas as agências, fora do
 * escopo normal de RLS). Só chamado a partir de rotas atrás de
 * `requireSuperAdmin` — nunca exposto a um usuário comum.
 */
import type { AgenciaAdmin, StatusTenant } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import { getServiceClient } from '../lib/supabase';

export async function listarAgenciasAdmin(): Promise<AgenciaAdmin[]> {
  const service = getServiceClient();
  const { data: agencias, error } = await service
    .from('agencias')
    .select('id, nome, plano, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar agências', error.message);

  const { data: assinaturas, error: assErr } = await service
    .from('assinaturas')
    .select('agencia_id, status');
  if (assErr) throw new HttpError(500, 'Falha ao listar assinaturas', assErr.message);
  const statusPorAgencia = new Map(assinaturas.map((a) => [a.agencia_id, a.status]));

  return agencias.map((a) => ({ ...a, assinatura_status: statusPorAgencia.get(a.id) ?? null }));
}

export async function atualizarStatusAgencia(
  agenciaId: string,
  status: StatusTenant,
): Promise<AgenciaAdmin> {
  const service = getServiceClient();
  const { data, error } = await service
    .from('agencias')
    .update({ status })
    .eq('id', agenciaId)
    .select('id, nome, plano, status, created_at')
    .single();
  if (error || !data) throw new HttpError(500, 'Falha ao atualizar status da agência', error?.message);

  const { data: assinatura } = await service
    .from('assinaturas')
    .select('status')
    .eq('agencia_id', agenciaId)
    .maybeSingle();

  return { ...data, assinatura_status: assinatura?.status ?? null };
}
