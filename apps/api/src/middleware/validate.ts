/** Validação de input com Zod (CLAUDE.md §7: Zod em toda rota). */
import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { HttpError } from '../lib/http';

/**
 * Valida `req.body` contra o schema e substitui pelo valor parseado/normalizado.
 * Em erro, responde 422 com a lista de issues (sem vazar dados sensíveis).
 */
export function validateBody<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new HttpError(422, 'Dados inválidos', result.error.flatten());
    }
    // result.data já é o tipo inferido do schema; substitui o body cru.
    // `unknown` evita propagar `any` — as rotas fazem o narrow com o tipo do schema.
    req.body = result.data as unknown;
    next();
  };
}

/** Valida um parâmetro de rota (ex.: `:id` como UUID). */
export function validateParam<S extends ZodTypeAny>(nome: string, schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params[nome]);
    if (!result.success) {
      throw new HttpError(400, `Parâmetro "${nome}" inválido`);
    }
    next();
  };
}
