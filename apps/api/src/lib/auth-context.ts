/** Contexto de autenticação anexado à request após `authenticate`. */
import type { Papel } from '@ax-ads/shared';
import type { Request } from 'express';
import { HttpError } from './http';
import type { DbClient } from './supabase';

export interface AuthContext {
  /** ID no Supabase Auth (auth.users.id). */
  authUserId: string;
  /** ID na tabela `usuarios`. */
  usuarioId: string;
  agenciaId: string;
  papel: Papel;
  /** Cliente Supabase escopado no usuário — RLS aplicada. */
  db: DbClient;
}

// Augmenta o Request do Express com o contexto autenticado (opcional até o middleware rodar).
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** Recupera o contexto autenticado ou lança 401 se ausente (guard tipado). */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new HttpError(401, 'Não autenticado');
  }
  return req.auth;
}
