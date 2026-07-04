/** Healthcheck público (sem auth) — usado por monitor/CI/PWA. */
import { Router } from 'express';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'ax-ads-api' });
});
