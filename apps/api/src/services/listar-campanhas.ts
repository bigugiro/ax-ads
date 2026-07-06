/**
 * Lista campanhas do espelho enriquecidas com o contexto de conta/cliente
 * (Sprint 3). IO fino sobre o client do USUÁRIO (RLS). Junta em memória para
 * não depender de embeds do PostgREST.
 */
import type { CampanhaComContexto, ListarCampanhasQuery } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';

export async function listarCampanhas(
  db: DbClient,
  filtros: ListarCampanhasQuery,
): Promise<CampanhaComContexto[]> {
  // Contas em escopo (aplica filtros de cliente/conta).
  let contasQuery = db.from('contas_anuncio').select('id, nome, plataforma, cliente_id');
  if (filtros.cliente_id) contasQuery = contasQuery.eq('cliente_id', filtros.cliente_id);
  if (filtros.conta_anuncio_id) contasQuery = contasQuery.eq('id', filtros.conta_anuncio_id);
  const { data: contas, error: contaErr } = await contasQuery;
  if (contaErr) throw new HttpError(500, 'Falha ao carregar contas', contaErr.message);

  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  const contaIds = contas.map((c) => c.id);
  if (contaIds.length === 0) return [];

  // Nomes de cliente (RLS já filtra por agência).
  const { data: clientes, error: cliErr } = await db.from('clientes').select('id, nome');
  if (cliErr) throw new HttpError(500, 'Falha ao carregar clientes', cliErr.message);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));

  const { data: campanhas, error: cmpErr } = await db
    .from('campanhas')
    .select('*')
    .in('conta_anuncio_id', contaIds)
    .order('budget', { ascending: false });
  if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanhas', cmpErr.message);

  return campanhas.flatMap((cmp) => {
    const conta = contaPorId.get(cmp.conta_anuncio_id);
    if (!conta) return [];
    return [
      {
        ...cmp,
        cliente_id: conta.cliente_id,
        cliente_nome: nomeCliente.get(conta.cliente_id) ?? '—',
        conta_nome: conta.nome,
        plataforma: conta.plataforma,
      },
    ];
  });
}
