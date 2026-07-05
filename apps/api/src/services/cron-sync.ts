/**
 * Sync diário de TODAS as contas ativas (Sprint 2). Roda com service role
 * (bypassa RLS) porque o job não tem usuário — cada linha escrita carrega seu
 * `agencia_id`, então o isolamento continua íntegro.
 *
 * Resiliente: uma conta que falha (ex.: provider real ainda em 501) não aborta
 * as demais; o erro entra no resumo. Mensagens de erro nunca carregam token
 * (contas demo não têm; ao plugar Meta/Google, manter essa garantia).
 */
import type { Database } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { getProvider } from '../providers';
import { DIAS_SYNC_INCREMENTAL, sincronizarConta, type ResumoSync } from './sync-conta';

type ContaRow = Database['public']['Tables']['contas_anuncio']['Row'];

export interface ResultadoContaSync {
  contaId: string;
  plataforma: ContaRow['plataforma'];
  ok: boolean;
  resumo?: ResumoSync;
  erro?: string;
}

export interface ResultadoCronSync {
  total: number;
  ok: number;
  falhas: number;
  contas: ResultadoContaSync[];
}

export async function sincronizarContasAtivas(
  db: DbClient,
  dias: number = DIAS_SYNC_INCREMENTAL,
): Promise<ResultadoCronSync> {
  const { data: contas, error } = await db.from('contas_anuncio').select('*').eq('status', 'ativa');
  if (error) throw new HttpError(500, 'Falha ao listar contas para sync', error.message);

  const resultados: ResultadoContaSync[] = [];
  for (const conta of contas) {
    try {
      const resumo = await sincronizarConta(db, conta, getProvider(conta.plataforma), dias);
      resultados.push({ contaId: conta.id, plataforma: conta.plataforma, ok: true, resumo });
    } catch (err) {
      resultados.push({
        contaId: conta.id,
        plataforma: conta.plataforma,
        ok: false,
        erro: err instanceof Error ? err.message : 'erro desconhecido',
      });
    }
  }

  const ok = resultados.filter((r) => r.ok).length;
  return { total: resultados.length, ok, falhas: resultados.length - ok, contas: resultados };
}
