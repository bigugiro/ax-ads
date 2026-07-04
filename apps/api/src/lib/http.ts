/** Utilitários HTTP: erro tipado e wrapper async para rotas Express. */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Erro com status HTTP. O handler global traduz para JSON. */
export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Encaminha rejeições de handlers async para o error handler do Express. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
