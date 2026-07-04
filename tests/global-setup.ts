/** Provisiona um usuário de teste (owner) no Supabase para os fluxos e2e. */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { CRED_FILE, TMP_DIR, type E2EUser } from './support/paths';

config({ path: ['.env.local', '.env'] });

export default async function globalSetup(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('E2E requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).');
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: ag, error: agErr } = await service
    .from('agencias')
    .insert({ nome: `E2E ${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (agErr || !ag) throw agErr ?? new Error('agência e2e não criada');

  const email = `e2e_${randomUUID()}@example.com`;
  const password = `Pw_${randomUUID().slice(0, 12)}`;
  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData.user) throw authErr ?? new Error('usuário auth e2e não criado');

  const { error: uErr } = await service.from('usuarios').insert({
    agencia_id: ag.id,
    nome: 'E2E',
    email,
    papel: 'owner',
    auth_supabase_id: authData.user.id,
  });
  if (uErr) throw uErr;

  const user: E2EUser = { email, password, agenciaId: ag.id, authUserId: authData.user.id };
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(CRED_FILE, JSON.stringify(user), 'utf8');
}
