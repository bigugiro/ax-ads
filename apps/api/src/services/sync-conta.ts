/**
 * Sync de uma conta de anúncio: lê do `AdsProvider` e materializa o espelho
 * no banco (campanhas → conjuntos → anúncios → métricas diárias).
 *
 * Roda com o client do USUÁRIO (RLS aplicada): quem sincroniza precisa ser
 * gestor+ da agência dona da conta — o banco garante, não só a rota.
 */
import type { AdsProvider, Database, PeriodoMetricas } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import {
  chaveEntidade,
  chunk,
  mapearMetricasParaLinhas,
  periodoUltimosDias,
} from '../lib/sync-espelho';

type ContaRow = Database['public']['Tables']['contas_anuncio']['Row'];

export interface ResumoSync {
  campanhas: number;
  conjuntos: number;
  anuncios: number;
  metricas: number;
  periodo: PeriodoMetricas;
}

/** Dias de histórico trazidos no sync (plano: 60–90 dias de métricas). */
export const DIAS_HISTORICO_SYNC = 90;

const LOTE_METRICAS = 500;

export async function sincronizarConta(
  db: DbClient,
  conta: ContaRow,
  provider: AdsProvider,
  dias: number = DIAS_HISTORICO_SYNC,
): Promise<ResumoSync> {
  const acc = conta.external_account_id;

  const [campanhas, conjuntos, anuncios] = await Promise.all([
    provider.listarCampanhas(acc),
    provider.listarConjuntos(acc),
    provider.listarAnuncios(acc),
  ]);

  // Mapa (tipo|externalId) → id local, preenchido a cada nível upsertado.
  const idLocal = new Map<string, string>();

  // ----- campanhas -----
  const { data: cmpRows, error: cmpErr } = await db
    .from('campanhas')
    .upsert(
      campanhas.map((c) => ({
        agencia_id: conta.agencia_id,
        conta_anuncio_id: conta.id,
        external_id: c.externalId,
        nome: c.nome,
        objetivo: c.objetivo,
        status: c.status,
        budget: c.budget,
        budget_tipo: c.budgetTipo,
      })),
      { onConflict: 'conta_anuncio_id,external_id' },
    )
    .select('id, external_id');
  if (cmpErr) throw new HttpError(500, 'Falha ao espelhar campanhas', cmpErr.message);
  for (const r of cmpRows ?? []) idLocal.set(chaveEntidade('campanha', r.external_id), r.id);

  // ----- conjuntos -----
  const linhasConjuntos = conjuntos.map((cj) => {
    const campanhaId = idLocal.get(chaveEntidade('campanha', cj.campanhaExternalId));
    if (!campanhaId) {
      throw new HttpError(502, `Provider incoerente: conjunto "${cj.externalId}" sem campanha`);
    }
    return {
      agencia_id: conta.agencia_id,
      campanha_id: campanhaId,
      external_id: cj.externalId,
      nome: cj.nome,
      status: cj.status,
      budget: cj.budget,
      publico: cj.publico,
    };
  });
  const { data: cjRows, error: cjErr } = await db
    .from('conjuntos')
    .upsert(linhasConjuntos, { onConflict: 'campanha_id,external_id' })
    .select('id, external_id');
  if (cjErr) throw new HttpError(500, 'Falha ao espelhar conjuntos', cjErr.message);
  for (const r of cjRows ?? []) idLocal.set(chaveEntidade('conjunto', r.external_id), r.id);

  // ----- anuncios -----
  const linhasAnuncios = anuncios.map((an) => {
    const conjuntoId = idLocal.get(chaveEntidade('conjunto', an.conjuntoExternalId));
    if (!conjuntoId) {
      throw new HttpError(502, `Provider incoerente: anúncio "${an.externalId}" sem conjunto`);
    }
    return {
      agencia_id: conta.agencia_id,
      conjunto_id: conjuntoId,
      external_id: an.externalId,
      nome: an.nome,
      status: an.status,
      criativo_ref: an.criativoRef,
    };
  });
  const { data: adRows, error: adErr } = await db
    .from('anuncios')
    .upsert(linhasAnuncios, { onConflict: 'conjunto_id,external_id' })
    .select('id, external_id');
  if (adErr) throw new HttpError(500, 'Falha ao espelhar anúncios', adErr.message);
  for (const r of adRows ?? []) idLocal.set(chaveEntidade('anuncio', r.external_id), r.id);

  // ----- métricas diárias -----
  const periodo = periodoUltimosDias(dias);
  const metricas = await provider.listarMetricasDiarias(acc, periodo);
  const { linhas, semEspelho } = mapearMetricasParaLinhas(conta.agencia_id, metricas, idLocal);
  if (semEspelho > 0) {
    throw new HttpError(
      502,
      `Provider incoerente: ${semEspelho} métrica(s) sem entidade no espelho`,
    );
  }
  for (const lote of chunk(linhas, LOTE_METRICAS)) {
    const { error } = await db
      .from('metricas_diarias')
      .upsert(lote, { onConflict: 'entidade_tipo,entidade_id,data' });
    if (error) throw new HttpError(500, 'Falha ao espelhar métricas', error.message);
  }

  // ----- carimbo do sync -----
  const { error: syncErr } = await db
    .from('contas_anuncio')
    .update({ ultimo_sync_at: new Date().toISOString() })
    .eq('id', conta.id);
  if (syncErr) throw new HttpError(500, 'Falha ao registrar sync', syncErr.message);

  return {
    campanhas: campanhas.length,
    conjuntos: conjuntos.length,
    anuncios: anuncios.length,
    metricas: linhas.length,
    periodo,
  };
}
