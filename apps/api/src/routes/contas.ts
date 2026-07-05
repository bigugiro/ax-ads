/**
 * Rotas de `contas_anuncio` (Sprint 1) — conectar, listar, sincronizar,
 * pausar/reativar e desconectar contas via camada `AdsProvider`.
 * Sem OAuth aqui: contas `demo` conectam direto; Meta/Google chegam nos
 * Sprints 11–12 respondendo 501 até lá. Toda mudança de estado é auditada.
 */
import {
  atualizarContaSchema,
  conectarContaSchema,
  listarContasQuerySchema,
  plataformaSchema,
  uuidSchema,
} from '@ax-ads/shared';
import type { AtualizarConta, ConectarConta } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { registrarAudit } from '../lib/audit';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import { getProvider } from '../providers';
import { sincronizarConta } from '../services/sync-conta';

export const contasRouter: Router = Router();

contasRouter.use(authenticate);

// Listar contas da agência, com filtro opcional por cliente (qualquer papel).
contasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listarContasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());

    const { db } = getAuth(req);
    let consulta = db.from('contas_anuncio').select('*').order('created_at', { ascending: false });
    if (query.data.cliente_id) consulta = consulta.eq('cliente_id', query.data.cliente_id);

    const { data, error } = await consulta;
    if (error) throw new HttpError(500, 'Falha ao listar contas', error.message);
    res.json({ data });
  }),
);

// Contas disponíveis para conectar na plataforma (gestor+; hoje só `demo`).
contasRouter.get(
  '/disponiveis',
  requireAcao('conectar_conta'),
  asyncHandler(async (req, res) => {
    const plataforma = plataformaSchema.safeParse(req.query.plataforma ?? 'demo');
    if (!plataforma.success) throw new HttpError(422, 'Plataforma inválida');

    const contas = await getProvider(plataforma.data).listarContas();
    res.json({ data: contas });
  }),
);

// Conectar conta a um cliente e popular o espelho (campanhas → métricas).
contasRouter.post(
  '/',
  requireAcao('conectar_conta'),
  validateBody(conectarContaSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const body = req.body as ConectarConta;
    const provider = getProvider(body.plataforma); // 501 se Meta/Google

    // Cliente precisa existir E ser da agência (RLS filtra o resto).
    const { data: cliente, error: cliErr } = await db
      .from('clientes')
      .select('id')
      .eq('id', body.cliente_id)
      .maybeSingle();
    if (cliErr) throw new HttpError(500, 'Falha ao carregar cliente', cliErr.message);
    if (!cliente) throw new HttpError(404, 'Cliente não encontrado');

    const contaProvider = await provider.buscarConta(body.external_account_id);
    if (!contaProvider) throw new HttpError(404, 'Conta não encontrada na plataforma');

    const { data: conta, error } = await db
      .from('contas_anuncio')
      .insert({
        agencia_id: agenciaId,
        cliente_id: body.cliente_id,
        plataforma: body.plataforma,
        external_account_id: contaProvider.externalAccountId,
        nome: contaProvider.nome,
        moeda: contaProvider.moeda,
      })
      .select('*')
      .single();
    if (error?.code === '23505') {
      throw new HttpError(409, 'Esta conta já está conectada a este cliente');
    }
    if (error || !conta) throw new HttpError(500, 'Falha ao conectar conta', error?.message);

    // Sync inicial: se falhar, desfaz a conexão — sem conta meio-populada.
    let sync;
    try {
      sync = await sincronizarConta(db, conta, provider);
    } catch (err) {
      await db.from('contas_anuncio').delete().eq('id', conta.id);
      throw err;
    }

    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'conectar',
      entidade: 'conta_anuncio',
      antes: null,
      depois: conta,
    });

    res.status(201).json({ data: conta, sync });
  }),
);

// Re-sincronizar o espelho de uma conta já conectada (gestor+).
contasRouter.post(
  '/:id/sync',
  requireAcao('conectar_conta'),
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);

    const { data: conta, error } = await db
      .from('contas_anuncio')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new HttpError(500, 'Falha ao carregar conta', error.message);
    if (!conta) throw new HttpError(404, 'Conta não encontrada');
    if (conta.status !== 'ativa') {
      throw new HttpError(409, `Conta "${conta.status}" não sincroniza — reative antes`);
    }

    const sync = await sincronizarConta(db, conta, getProvider(conta.plataforma));

    // Recarrega para devolver o carimbo `ultimo_sync_at` gravado pelo sync.
    const { data: atualizada } = await db
      .from('contas_anuncio')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    res.json({ data: atualizada ?? conta, sync });
  }),
);

// Pausar/reativar a conexão (gestor+; auditado).
contasRouter.patch(
  '/:id',
  requireAcao('conectar_conta'),
  validateParam('id', uuidSchema),
  validateBody(atualizarContaSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarConta;

    const { data: antes, error: errAntes } = await db
      .from('contas_anuncio')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errAntes) throw new HttpError(500, 'Falha ao carregar conta', errAntes.message);
    if (!antes) throw new HttpError(404, 'Conta não encontrada');

    const { data: depois, error } = await db
      .from('contas_anuncio')
      .update({ status: patch.status })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !depois) throw new HttpError(500, 'Falha ao atualizar conta', error?.message);

    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'atualizar',
      entidade: 'conta_anuncio',
      antes: { status: antes.status },
      depois: { status: depois.status },
    });

    res.json({ data: depois });
  }),
);

// Desconectar (gestor+): remove a conta e o espelho inteiro (cascade).
contasRouter.delete(
  '/:id',
  requireAcao('conectar_conta'),
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);

    const { data: conta, error: errConta } = await db
      .from('contas_anuncio')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errConta) throw new HttpError(500, 'Falha ao carregar conta', errConta.message);
    if (!conta) throw new HttpError(404, 'Conta não encontrada');

    const { error } = await db.from('contas_anuncio').delete().eq('id', id);
    if (error) throw new HttpError(500, 'Falha ao desconectar conta', error.message);

    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'desconectar',
      entidade: 'conta_anuncio',
      antes: conta,
      depois: null,
    });

    res.status(204).end();
  }),
);
