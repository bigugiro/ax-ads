/**
 * Auditoria (CLAUDE.md §5): toda alteração de estado sensível escreve em `audit_log`.
 * A parte pura (diff) é testável isoladamente; a escrita usa a service role.
 */
import type { Json } from '@ax-ads/shared';
import { getServiceClient } from './supabase';

/** Campos serializáveis em JSON — compatível com as colunas jsonb do audit_log. */
export type Campos = Record<string, Json | undefined>;

export interface RegistroAudit {
  agencia_id: string;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  antes: Campos | null;
  depois: Campos | null;
}

/**
 * Reduz `antes`/`depois` apenas aos campos que mudaram — mantém o audit enxuto
 * e evita registrar dados irrelevantes. Retorna `null`/`null` se nada mudou.
 */
export function diffCampos(
  antes: Campos,
  depois: Campos,
): { antes: Campos | null; depois: Campos | null } {
  const mudouAntes: Campos = {};
  const mudouDepois: Campos = {};
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  for (const k of chaves) {
    if (!Object.is(antes[k], depois[k])) {
      mudouAntes[k] = antes[k];
      mudouDepois[k] = depois[k];
    }
  }
  const houveMudanca = Object.keys(mudouDepois).length > 0;
  return houveMudanca ? { antes: mudouAntes, depois: mudouDepois } : { antes: null, depois: null };
}

/** Persiste um registro de auditoria (via service role, ignora RLS de escrita). */
export async function registrarAudit(registro: RegistroAudit): Promise<void> {
  const { error } = await getServiceClient().from('audit_log').insert(registro);
  if (error) {
    // Auditoria é crítica: não engolir silenciosamente. Nunca logamos payload sensível.
    throw new Error(`Falha ao gravar audit_log: ${error.message}`);
  }
}
