/** Autorização por papel: bloqueia se o usuário não pode executar a ação. */
import { podeExecutar, type Acao } from '@ax-ads/shared';
import type { RequestHandler } from 'express';
import { getAuth } from '../lib/auth-context';
import { HttpError } from '../lib/http';

/** Exige que o papel do usuário autorize a `acao` (ver mapa em @ax-ads/shared). */
export function requireAcao(acao: Acao): RequestHandler {
  return (req, _res, next) => {
    const { papel } = getAuth(req);
    if (!podeExecutar(papel, acao)) {
      throw new HttpError(403, `Papel "${papel}" não pode executar "${acao}"`);
    }
    next();
  };
}
