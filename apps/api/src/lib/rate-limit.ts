/**
 * Rate limit em memória (Sprint 10, pen-test básico) — janela fixa por
 * chave (ex.: IP). Puro o bastante pra testar com timestamp injetado, sem
 * depender de biblioteca externa. Suficiente pro processo único do dev/
 * Vercel Function; não é um limitador distribuído (ok pro escopo desta
 * sprint — documentado em SECURITY_CHECKLIST.md).
 */
import type { RequestHandler } from 'express';
import { HttpError } from './http';

interface Janela {
  contagem: number;
  expiraEm: number;
}

const buckets = new Map<string, Janela>();

/** `true` se a chamada é permitida (e conta pra janela); `false` se estourou o limite. */
export function permitirChamada(
  chave: string,
  opts: { limite: number; janelaMs: number },
  agora: number,
): boolean {
  const atual = buckets.get(chave);
  if (!atual || atual.expiraEm <= agora) {
    buckets.set(chave, { contagem: 1, expiraEm: agora + opts.janelaMs });
    return true;
  }
  if (atual.contagem >= opts.limite) return false;
  atual.contagem += 1;
  return true;
}

/** Só para testes: zera o estado entre casos. */
export function _resetRateLimitParaTestes(): void {
  buckets.clear();
}

/** Middleware Express — chave por IP + rota (mesmo IP não compete entre rotas diferentes). */
export function rateLimit(
  nome: string,
  opts: { limite: number; janelaMs: number },
): RequestHandler {
  return (req, _res, next) => {
    const chave = `${nome}:${req.ip ?? 'sem-ip'}`;
    if (!permitirChamada(chave, opts, Date.now())) {
      throw new HttpError(429, 'Muitas tentativas — aguarde um pouco e tente de novo');
    }
    next();
  };
}
