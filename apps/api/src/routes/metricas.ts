/**
 * Rotas de leitura do Dashboard (Sprint 2).
 * `GET /metricas` — resumo agregado da agência (total + quebra por cliente) no
 * período, com filtro opcional por cliente. Leitura pura: qualquer papel
 * (`ver_dashboard` = viewer+). A RLS garante o isolamento por agência.
 */
import { metricasQuerySchema } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { periodoDaQuery, resumoDaAgencia } from '../services/metricas';

export const metricasRouter: Router = Router();

metricasRouter.use(authenticate);

metricasRouter.get(
  '/',
  requireAcao('ver_dashboard'),
  asyncHandler(async (req, res) => {
    const query = metricasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());

    const { db } = getAuth(req);
    const periodo = periodoDaQuery(query.data);
    const resumo = await resumoDaAgencia(db, periodo, query.data.cliente_id);
    res.json({ data: resumo });
  }),
);
