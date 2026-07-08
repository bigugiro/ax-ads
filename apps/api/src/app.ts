/** Fábrica do app Express (usada pelo servidor local, pelos testes e pela função Vercel). */
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { corsOrigins } from './lib/env';
import { errorHandler, notFound } from './middleware/error';
import { authRouter } from './routes/auth';
import { billingRouter } from './routes/billing';
import { campanhasRouter } from './routes/campanhas';
import { clientesRouter } from './routes/clientes';
import { contasRouter } from './routes/contas';
import { cronRouter } from './routes/cron';
import { crmRouter } from './routes/crm';
import { estrategiasRouter } from './routes/estrategias';
import { healthRouter } from './routes/health';
import { iaRouter } from './routes/ia';
import { metricasRouter } from './routes/metricas';
import { pdcaRouter } from './routes/pdca';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins() }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  // Rota pública (sem authenticate): onboarding self-service.
  app.use(authRouter);
  // Rotas com caminhos absolutos próprios (/assinatura, /billing/*) — webhook é público.
  app.use(billingRouter);
  app.use('/clientes', clientesRouter);
  app.use('/contas', contasRouter);
  app.use('/campanhas', campanhasRouter);
  app.use('/metricas', metricasRouter);
  app.use('/cron', cronRouter);
  // Rotas com caminhos absolutos próprios (/estrategias, /clientes/:id/estrategias/...).
  app.use(estrategiasRouter);
  // Rotas com caminhos absolutos próprios (/pipelines, /leads, /automacoes).
  app.use(crmRouter);
  // Rotas com caminhos absolutos próprios (/ia/*, /clientes/:id/criativos, .../geracoes-ia).
  app.use(iaRouter);
  // Rotas com caminhos absolutos próprios (/clientes/:id/anomalias, /recomendacoes/*, /regras-otimizacao).
  app.use(pdcaRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
