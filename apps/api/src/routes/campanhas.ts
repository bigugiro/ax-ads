/**
 * Rotas de campanhas (Sprint 3) — listar e OPERAR (pausar/ativar/ajustar budget)
 * via `AdsProvider`. Toda ação: aplica no provedor → atualiza o espelho → grava
 * em `audit_log` (regra 5 do CLAUDE.md). Papel mínimo: gestor (`operar_campanha`).
 */
import { atualizarCampanhaSchema, listarCampanhasQuerySchema, uuidSchema } from '@ax-ads/shared';
import type { AtualizarCampanha } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import { operarCampanha } from '../services/campanhas';
import { listarCampanhas } from '../services/listar-campanhas';

export const campanhasRouter: Router = Router();

campanhasRouter.use(authenticate);

// Listar campanhas do espelho (qualquer papel; RLS filtra por agência).
campanhasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listarCampanhasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());

    const { db } = getAuth(req);
    const data = await listarCampanhas(db, query.data);
    res.json({ data });
  }),
);

// Operar campanha: pausar/ativar e/ou ajustar budget (gestor+).
campanhasRouter.patch(
  '/:id',
  requireAcao('operar_campanha'),
  validateParam('id', uuidSchema),
  validateBody(atualizarCampanhaSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const campanhaId = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarCampanha;
    const data = await operarCampanha(db, { agenciaId, usuarioId, campanhaId, patch });
    res.json({ data });
  }),
);
