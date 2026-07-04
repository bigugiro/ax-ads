/** Autenticação: valida o JWT Supabase e carrega o perfil (agência + papel). */
import { ehPapel } from '@ax-ads/shared';
import { asyncHandler, HttpError } from '../lib/http';
import { createUserClient } from '../lib/supabase';

function extrairBearer(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Token ausente ou malformado');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new HttpError(401, 'Token ausente');
  return token;
}

/**
 * Middleware: exige um access token válido do Supabase.
 * Anexa `req.auth` com um cliente escopado (RLS) + agência/papel do usuário.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extrairBearer(req.header('authorization'));
  const db = createUserClient(token);

  // Valida o token contra o Supabase Auth.
  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData.user) {
    throw new HttpError(401, 'Token inválido ou expirado');
  }

  // Carrega o perfil na agência (RLS permite ler o próprio registro).
  const { data: perfil, error: perfilError } = await db
    .from('usuarios')
    .select('id, agencia_id, papel')
    .eq('auth_supabase_id', userData.user.id)
    .single();

  if (perfilError || !perfil) {
    throw new HttpError(403, 'Usuário sem vínculo com uma agência');
  }
  if (!ehPapel(perfil.papel)) {
    throw new HttpError(500, 'Papel de usuário inválido');
  }

  req.auth = {
    authUserId: userData.user.id,
    usuarioId: perfil.id,
    agenciaId: perfil.agencia_id,
    papel: perfil.papel,
    db,
  };
  next();
});
