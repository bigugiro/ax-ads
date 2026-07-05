/**
 * Rotas de métricas (Sprint 2) — painel do dashboard.
 * Leitura pura (nenhuma alteração de estado externo → sem audit).
 * `ver_dashboard` é liberado a qualquer papel; a checagem fica explícita
 * para documentar a permissão e blindar contra regressão do mapa de papéis.
 */
import { dashboardQuerySchema } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { carregarDashboard } from '../services/metricas-dashboard';

export const metricasRouter: Router = Router();

metricasRouter.use(authenticate);

// Painel: KPIs gerais (com comparação), série diária e quebra por cliente/campanha.
metricasRouter.get(
  '/dashboard',
  requireAcao('ver_dashboard'),
  asyncHandler(async (req, res) => {
    const query = dashboardQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());

    const { db } = getAuth(req);
    const dashboard = await carregarDashboard(db, query.data.dias, query.data.cliente_id);
    res.json({ data: dashboard });
  }),
);
