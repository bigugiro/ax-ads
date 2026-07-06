/**
 * Serviço de Estratégias (Sprint 4, Seção 6 do plano): catálogo global,
 * aplicar em cliente (gera checklist + captura baseline), listar aplicadas
 * com progresso e resultado medido ao vivo, e mover status/checklist.
 *
 * Medição de resultado reaproveita o serviço do dashboard (Sprint 2): a
 * mesma agregação de ROAS/CAC que o painel mostra é a que compara o "antes"
 * (baseline, capturada ao aplicar) com o "agora" — uma única fórmula no sistema.
 */
import type {
  AtualizarChecklistItem,
  AtualizarEstrategiaAplicada,
  ChecklistComProgresso,
  Estrategia,
  EstrategiaAplicadaComContexto,
  EstrategiaChecklistItem,
  Json,
  ListarEstrategiasQuery,
  ResultadoEstrategia,
  StatusEstrategiaAplicada,
} from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { carregarDashboard } from './metricas-dashboard';

/** Janela usada tanto na baseline (ao aplicar) quanto no "atual" (ao listar). */
const DIAS_MEDICAO = 30;

export async function listarCatalogo(
  db: DbClient,
  filtros: ListarEstrategiasQuery,
): Promise<Estrategia[]> {
  let query = db.from('estrategias').select('*').eq('ativo', true).order('categoria');
  if (filtros.canal) query = query.eq('canal', filtros.canal);
  if (filtros.nivel) query = query.eq('nivel', filtros.nivel);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar estratégias', error.message);
  return data as Estrategia[];
}

export async function buscarEstrategia(db: DbClient, id: string): Promise<Estrategia> {
  const { data, error } = await db.from('estrategias').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao carregar estratégia', error.message);
  if (!data) throw new HttpError(404, 'Estratégia não encontrada');
  return data as Estrategia;
}

async function carregarChecklist(
  db: DbClient,
  estrategiaAplicadaId: string,
): Promise<ChecklistComProgresso> {
  const { data, error } = await db
    .from('estrategia_checklist_itens')
    .select('*')
    .eq('estrategia_aplicada_id', estrategiaAplicadaId)
    .order('ordem');
  if (error) throw new HttpError(500, 'Falha ao carregar checklist', error.message);
  const itens = data as EstrategiaChecklistItem[];
  return { itens, feitos: itens.filter((i) => i.feito).length, total: itens.length };
}

/**
 * Aplica a estratégia no cliente: cria a instância + o checklist executável
 * a partir dos `passos` do catálogo, e captura a baseline de métricas (Sprint
 * 2) para medir o resultado depois. Bloqueia se já existe aplicação ativa
 * (analisando/aplicada) da mesma estratégia nesse cliente — reflete o índice
 * único parcial da migration com uma mensagem amigável.
 */
export async function aplicarEstrategia(
  db: DbClient,
  params: { agenciaId: string; clienteId: string; estrategiaId: string },
): Promise<EstrategiaAplicadaComContexto> {
  const { agenciaId, clienteId, estrategiaId } = params;

  const { data: cliente, error: cliErr } = await db
    .from('clientes')
    .select('id')
    .eq('id', clienteId)
    .maybeSingle();
  if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
  if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

  const estrategia = await buscarEstrategia(db, estrategiaId);
  if (!estrategia.ativo) throw new HttpError(409, 'Estratégia não está ativa no catálogo');

  const dashboard = await carregarDashboard(db, DIAS_MEDICAO, clienteId);
  const resultado: ResultadoEstrategia = {
    periodoBaseline: dashboard.periodo,
    baseline: dashboard.geral.atual,
  };

  const { data: aplicada, error } = await db
    .from('estrategias_aplicadas')
    .insert({
      agencia_id: agenciaId,
      cliente_id: clienteId,
      estrategia_id: estrategiaId,
      estrategia_versao: estrategia.versao,
      status: 'aplicada',
      aplicada_em: new Date().toISOString(),
      resultado: resultado as unknown as Json,
    })
    .select('*')
    .single();
  if (error?.code === '23505') {
    throw new HttpError(409, 'Esta estratégia já está em andamento neste cliente');
  }
  if (error || !aplicada) throw new HttpError(500, 'Falha ao aplicar estratégia', error?.message);

  const passos = estrategia.passos;
  let itens: EstrategiaChecklistItem[] = [];
  if (passos.length > 0) {
    const { data: checklistRows, error: checklistErr } = await db
      .from('estrategia_checklist_itens')
      .insert(
        passos.map((descricao, i) => ({
          agencia_id: agenciaId,
          estrategia_aplicada_id: aplicada.id,
          descricao,
          ordem: i,
        })),
      )
      .select('*')
      .order('ordem');
    if (checklistErr) throw new HttpError(500, 'Falha ao gerar checklist', checklistErr.message);
    itens = checklistRows;
  }

  return {
    ...aplicada,
    estrategia_titulo: estrategia.titulo,
    estrategia_slug: estrategia.slug,
    estrategia_kpi_sucesso: estrategia.kpi_sucesso,
    checklist: { itens, feitos: 0, total: itens.length },
    atual: dashboard.geral.atual,
  };
}

export async function listarAplicadasPorCliente(
  db: DbClient,
  clienteId: string,
): Promise<EstrategiaAplicadaComContexto[]> {
  const { data: aplicadas, error } = await db
    .from('estrategias_aplicadas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar estratégias aplicadas', error.message);
  if (aplicadas.length === 0) return [];

  const idsEstrategia = [...new Set(aplicadas.map((a) => a.estrategia_id))];
  const { data: estrategiasDoCatalogo, error: catErr } = await db
    .from('estrategias')
    .select('id, titulo, slug, kpi_sucesso')
    .in('id', idsEstrategia);
  if (catErr) throw new HttpError(500, 'Falha ao carregar catálogo', catErr.message);
  const catalogoPorId = new Map(estrategiasDoCatalogo.map((e) => [e.id, e]));

  // "Atual" é uma única leitura de dashboard para o cliente inteiro (mesma
  // janela p/ todas as aplicações) — reaproveitada em vez de recalculada por item.
  const dashboard = await carregarDashboard(db, DIAS_MEDICAO, clienteId);

  return Promise.all(
    aplicadas.map(async (a) => {
      const cat = catalogoPorId.get(a.estrategia_id);
      const checklist = await carregarChecklist(db, a.id);
      return {
        ...a,
        estrategia_titulo: cat?.titulo ?? '—',
        estrategia_slug: cat?.slug ?? '',
        estrategia_kpi_sucesso: cat?.kpi_sucesso ?? '',
        checklist,
        atual: dashboard.geral.atual,
      };
    }),
  );
}

export async function atualizarAplicada(
  db: DbClient,
  id: string,
  patch: AtualizarEstrategiaAplicada,
): Promise<{ antes: { status: string }; depois: { id: string; status: string } }> {
  const { data: antes, error: antesErr } = await db
    .from('estrategias_aplicadas')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (antesErr) throw new HttpError(500, 'Falha ao carregar aplicação', antesErr.message);
  if (!antes) throw new HttpError(404, 'Aplicação de estratégia não encontrada');

  const mudancas: { status?: StatusEstrategiaAplicada; notas?: string | null } = {};
  if (patch.status !== undefined) mudancas.status = patch.status;
  if (patch.notas !== undefined) mudancas.notas = patch.notas;

  const { data: depois, error } = await db
    .from('estrategias_aplicadas')
    .update(mudancas)
    .eq('id', id)
    .select('id, status')
    .single();
  if (error || !depois) throw new HttpError(500, 'Falha ao atualizar aplicação', error?.message);

  return { antes, depois };
}

export async function atualizarChecklistItem(
  db: DbClient,
  id: string,
  patch: AtualizarChecklistItem,
): Promise<{ id: string; feito: boolean }> {
  const { data, error } = await db
    .from('estrategia_checklist_itens')
    .update({ feito: patch.feito })
    .eq('id', id)
    .select('id, feito')
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao atualizar checklist', error.message);
  if (!data) throw new HttpError(404, 'Item de checklist não encontrado');
  return data;
}
