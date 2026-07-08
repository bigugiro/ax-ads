/** `GET /me` (Sprint 10) — "quem sou eu": usuário + agência (papel, marca,
 *  super_admin). Fonte única pro front decidir o que mostrar (branding,
 *  link de Admin) sem replicar lógica de sessão em vários lugares. */
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { buscarMeuUsuario, buscarMinhaAgencia } from '../services/agencias';

export const meRouter: Router = Router();

meRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const [usuario, agencia] = await Promise.all([
      buscarMeuUsuario(db, usuarioId),
      buscarMinhaAgencia(db, agenciaId),
    ]);
    res.json({ data: { usuario, agencia } });
  }),
);
