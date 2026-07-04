/** Handlers de 404 e de erro. Nunca vaza segredo/stack em produção. */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/http';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details ?? null });
    return;
  }
  // Inesperado: log enxuto (sem payload sensível) + resposta genérica.
  const msg = err instanceof Error ? err.message : 'desconhecido';
  console.error('[api] erro não tratado:', msg);
  res.status(500).json({ error: 'Erro interno' });
};
