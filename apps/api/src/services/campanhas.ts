/**
 * Operar campanha (Sprint 3): aplica no `AdsProvider` → espelha no banco →
 * audita (regra 5 do CLAUDE.md). Extraído da rota para ser reaproveitado
 * pelo motor PDCA (Sprint 7) ao "aplicar" uma recomendação de pausar campanha.
 */
import type { AtualizarCampanha, Campanha } from '@ax-ads/shared';
import { registrarAudit, type Campos } from '../lib/audit';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { getProvider } from '../providers';

export async function operarCampanha(
  db: DbClient,
  params: { agenciaId: string; usuarioId: string; campanhaId: string; patch: AtualizarCampanha },
): Promise<Campanha> {
  const { agenciaId, usuarioId, campanhaId, patch } = params;

  const { data: campanha, error: cmpErr } = await db
    .from('campanhas')
    .select('*')
    .eq('id', campanhaId)
    .maybeSingle();
  if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanha', cmpErr.message);
  if (!campanha) throw new HttpError(404, 'Campanha não encontrada');

  const { data: conta, error: contaErr } = await db
    .from('contas_anuncio')
    .select('external_account_id, plataforma, status')
    .eq('id', campanha.conta_anuncio_id)
    .maybeSingle();
  if (contaErr) throw new HttpError(500, 'Falha ao carregar conta', contaErr.message);
  if (!conta) throw new HttpError(404, 'Conta da campanha não encontrada');
  if (conta.status !== 'ativa') {
    throw new HttpError(409, `Conta "${conta.status}" não opera campanhas — reative antes`);
  }

  const provider = getProvider(conta.plataforma);
  try {
    if (patch.status !== undefined) {
      await provider.atualizarStatusCampanha(
        conta.external_account_id,
        campanha.external_id,
        patch.status,
      );
    }
    if (patch.budget !== undefined) {
      await provider.atualizarBudgetCampanha(
        conta.external_account_id,
        campanha.external_id,
        patch.budget,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido';
    throw new HttpError(502, 'Falha ao aplicar a mudança no provedor', msg);
  }

  const mudancas: { status?: 'ativa' | 'pausada'; budget?: number } = {};
  if (patch.status !== undefined) mudancas.status = patch.status;
  if (patch.budget !== undefined) mudancas.budget = patch.budget;

  const { data: depois, error: updErr } = await db
    .from('campanhas')
    .update(mudancas)
    .eq('id', campanhaId)
    .select('*')
    .single();
  if (updErr || !depois) throw new HttpError(500, 'Falha ao atualizar campanha', updErr?.message);

  const antes: Campos = {};
  const depoisAudit: Campos = {};
  if (patch.status !== undefined) {
    antes.status = campanha.status;
    depoisAudit.status = depois.status;
  }
  if (patch.budget !== undefined) {
    antes.budget = campanha.budget;
    depoisAudit.budget = depois.budget;
  }
  await registrarAudit({
    agencia_id: agenciaId,
    usuario_id: usuarioId,
    acao: 'operar',
    entidade: 'campanha',
    antes,
    depois: depoisAudit,
  });

  return depois;
}
