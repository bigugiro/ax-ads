/** Fábrica do app Express (usada pelo servidor local, pelos testes e pela função Vercel). */
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { corsOrigins } from './lib/env';
import { errorHandler, notFound } from './middleware/error';
import { clientesRouter } from './routes/clientes';
import { contasRouter } from './routes/contas';
import { cronRouter } from './routes/cron';
import { healthRouter } from './routes/health';
import { metricasRouter } from './routes/metricas';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins() }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/clientes', clientesRouter);
  app.use('/contas', contasRouter);
  app.use('/metricas', metricasRouter);
  app.use('/cron', cronRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
