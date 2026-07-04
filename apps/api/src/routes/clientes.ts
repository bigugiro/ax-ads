/**
 * Rotas de `clientes` (o e-commerce atendido).
 * RLS garante isolamento por agência; a checagem de papel é defesa adicional.
 * Alterações de estado escrevem em `audit_log`.
 */
import { atualizarClienteSchema, criarClienteSchema, uuidSchema } from '@ax-ads/shared';
import type { AtualizarCliente, CriarCliente } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { diffCampos, registrarAudit } from '../lib/audit';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';

export const clientesRouter: Router = Router();

// Todas as rotas exigem autenticação.
clientesRouter.use(authenticate);

// Listar clientes da agência (qualquer papel; RLS filtra por agência).
clientesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const { data, error } = await db
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new HttpError(500, 'Falha ao listar clientes', error.message);
    res.json({ data });
  }),
);

// Criar cliente (gestor+).
clientesRouter.post(
  '/',
  requireAcao('gerenciar_clientes'),
  validateBody(criarClienteSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const body = req.body as CriarCliente;

    const { data, error } = await db
      .from('clientes')
      .insert({
        agencia_id: agenciaId,
        nome: body.nome,
        nicho: body.nicho ?? null,
        site: body.site ? body.site : null,
        status: body.status,
      })
      .select('*')
      .single();

    if (error || !data) throw new HttpError(500, 'Falha ao criar cliente', error?.message);

    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'criar',
      entidade: 'cliente',
      antes: null,
      depois: data,
    });

    res.status(201).json({ data });
  }),
);

// Atualizar cliente (gestor+).
clientesRouter.patch(
  '/:id',
  requireAcao('gerenciar_clientes'),
  validateParam('id', uuidSchema),
  validateBody(atualizarClienteSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    // validateParam já garantiu o formato; parse re-narra o tipo sem cast.
    const id = uuidSchema.parse(req.params.id);

    // Estado anterior (RLS garante que só vem se for da agência).
    const { data: antes, error: errAntes } = await db
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errAntes) throw new HttpError(500, 'Falha ao carregar cliente', errAntes.message);
    if (!antes) throw new HttpError(404, 'Cliente não encontrado');

    const patch = req.body as AtualizarCliente;
    const { data: depois, error } = await db
      .from('clientes')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !depois) throw new HttpError(500, 'Falha ao atualizar cliente', error?.message);

    const { antes: dAntes, depois: dDepois } = diffCampos(antes, depois);
    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'atualizar',
      entidade: 'cliente',
      antes: dAntes,
      depois: dDepois,
    });

    res.json({ data: depois });
  }),
);
