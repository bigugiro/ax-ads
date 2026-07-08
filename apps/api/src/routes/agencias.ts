/**
 * Rotas da própria agência (Sprint 10): marca (white-label básico) e
 * exclusão de conta (LGPD). Escrita exige `gerenciar_agencia` (owner) — a
 * marca também é protegida por RLS (`agencias_update`, Sprint 0), defesa em
 * profundidade.
 */
import { atualizarMarcaSchema } from '@ax-ads/shared';
import type { AtualizarMarca } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody } from '../middleware/validate';
import { atualizarMarca, excluirAgencia } from '../services/agencias';

// Montado em `/agencias` (ver app.ts) — o `.use(authenticate)` abaixo NUNCA
// deve rodar pra requests fora desse prefixo (Express roteia `router.use()`
// sem path pra TODA request que passa pelo router; um `app.use(agenciasRouter)`
// sem prefixo faria TODO request subsequente na cadeia — inclusive /cron/*,
// que não usa JWT — passar por `authenticate` e falhar).
export const agenciasRouter: Router = Router();

agenciasRouter.use(authenticate);

agenciasRouter.patch(
  '/marca',
  requireAcao('gerenciar_agencia'),
  validateBody(atualizarMarcaSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const patch = req.body as AtualizarMarca;
    const data = await atualizarMarca(db, agenciaId, patch);
    res.json({ data });
  }),
);

agenciasRouter.delete(
  '/me',
  requireAcao('gerenciar_agencia'),
  asyncHandler(async (req, res) => {
    const { agenciaId } = getAuth(req);
    await excluirAgencia(agenciaId);
    res.status(204).send();
  }),
);
