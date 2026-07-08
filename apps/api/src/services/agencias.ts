/**
 * Serviço da própria agência (Sprint 10): "quem sou eu", marca (white-label
 * básico) e exclusão de conta (LGPD — direito ao esquecimento). `agenciaId`
 * SEMPRE vem do contexto autenticado (JWT), nunca do payload — mesmo padrão
 * de billing.ts.
 */
import type { Agencia, AtualizarMarca, Usuario } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { getServiceClient } from '../lib/supabase';

export async function buscarMinhaAgencia(db: DbClient, agenciaId: string): Promise<Agencia> {
  const { data, error } = await db.from('agencias').select('*').eq('id', agenciaId).single();
  if (error || !data) throw new HttpError(500, 'Falha ao carregar agência', error?.message);
  return data;
}

export async function buscarMeuUsuario(db: DbClient, usuarioId: string): Promise<Usuario> {
  const { data, error } = await db.from('usuarios').select('*').eq('id', usuarioId).single();
  if (error || !data) throw new HttpError(500, 'Falha ao carregar usuário', error?.message);
  return data;
}

/** `PATCH /agencias/marca` — RLS já exige owner (`agencias_update`, Sprint 0). */
export async function atualizarMarca(
  db: DbClient,
  agenciaId: string,
  patch: AtualizarMarca,
): Promise<Agencia> {
  const mudancas: { marca_nome?: string | null; marca_cor?: string | null; marca_logo_url?: string | null } =
    {};
  if (patch.marca_nome !== undefined) mudancas.marca_nome = patch.marca_nome;
  if (patch.marca_cor !== undefined) mudancas.marca_cor = patch.marca_cor;
  if (patch.marca_logo_url !== undefined) {
    mudancas.marca_logo_url = patch.marca_logo_url === '' ? null : patch.marca_logo_url;
  }

  const { data, error } = await db
    .from('agencias')
    .update(mudancas)
    .eq('id', agenciaId)
    .select('*')
    .single();
  if (error || !data) throw new HttpError(500, 'Falha ao atualizar marca', error?.message);
  return data;
}

/**
 * `DELETE /agencias/me` — LGPD (direito ao esquecimento). Apaga a agência
 * (cascata apaga clientes/campanhas/leads/criativos/assinatura/audit_log/...)
 * e todos os usuários do Supabase Auth vinculados a ela. Irreversível.
 */
export async function excluirAgencia(agenciaId: string): Promise<void> {
  const service = getServiceClient();

  const { data: usuarios, error: userErr } = await service
    .from('usuarios')
    .select('auth_supabase_id')
    .eq('agencia_id', agenciaId);
  if (userErr) throw new HttpError(500, 'Falha ao carregar usuários da agência', userErr.message);

  const { error: delErr } = await service.from('agencias').delete().eq('id', agenciaId);
  if (delErr) throw new HttpError(500, 'Falha ao excluir agência', delErr.message);

  for (const u of usuarios) {
    await service.auth.admin.deleteUser(u.auth_supabase_id).catch(() => {});
  }
}
