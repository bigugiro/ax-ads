/** Remove o usuário/agência de teste criados no global-setup. */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, rmSync } from 'node:fs';
import { config } from 'dotenv';
import { CRED_FILE, TMP_DIR, type E2EUser } from './support/paths';

config({ path: ['.env.local', '.env'] });

export default async function globalTeardown(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  let user: E2EUser;
  try {
    user = JSON.parse(readFileSync(CRED_FILE, 'utf8')) as E2EUser;
  } catch {
    return; // nada a limpar
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Cascade remove usuarios/clientes/audit da agência.
  await service.from('agencias').delete().eq('id', user.agenciaId);
  await service.auth.admin.deleteUser(user.authUserId);

  rmSync(TMP_DIR, { recursive: true, force: true });
}
