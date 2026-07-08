/**
 * Rotas do operador do SaaS (Sprint 10) — cross-tenant, atrás de
 * `requireSuperAdmin`. Nenhuma tela pra maioria dos usuários; existe pra
 * quem opera a plataforma (não um papel de tenant).
 */
import { atualizarStatusAgenciaSchema, uuidSchema } from '@ax-ads/shared';
import type { AtualizarStatusAgencia } from '@ax-ads/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import { atualizarStatusAgencia, listarAgenciasAdmin } from '../services/admin';

// Montado em `/admin` (ver app.ts) — o gate abaixo NUNCA deve rodar pra
// requests fora desse prefixo (Express roteia `router.use()` sem path pra
// TODA request que passa pelo router; um `app.use(adminRouter)` sem prefixo
// bloquearia o app inteiro pra quem não é super_admin).
export const adminRouter: Router = Router();

adminRouter.use(authenticate, requireSuperAdmin);

adminRouter.get(
  '/agencias',
  asyncHandler(async (_req, res) => {
    const data = await listarAgenciasAdmin();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/agencias/:id',
  validateParam('id', uuidSchema),
  validateBody(atualizarStatusAgenciaSchema),
  asyncHandler(async (req, res) => {
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarStatusAgencia;
    const data = await atualizarStatusAgencia(id, patch.status);
    res.json({ data });
  }),
);
