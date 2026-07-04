/** Fábricas de clientes Supabase (tipados pelo schema `Database`). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ax-ads/shared';
import { getEnv } from './env';

/** Cliente Supabase tipado pelo schema do banco — usar este alias em todo o backend. */
export type DbClient = SupabaseClient<Database>;

let serviceClient: DbClient | undefined;

/**
 * Cliente com a SERVICE ROLE — **bypassa RLS**.
 * Usar apenas para operações privilegiadas: signup/provisionamento,
 * escrita de `audit_log` e jobs (cron). Nunca expor ao front.
 */
export function getServiceClient(): DbClient {
  if (!serviceClient) {
    const env = getEnv();
    serviceClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serviceClient;
}

/**
 * Cliente no escopo do usuário: envia o JWT dele em toda query,
 * então **a RLS é aplicada** (isolamento por agência garantido no banco).
 */
export function createUserClient(accessToken: string): DbClient {
  const env = getEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
