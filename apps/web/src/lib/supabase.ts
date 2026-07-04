/** Cliente Supabase do browser (chave pública anon). Nunca usar service role no front. */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ax-ads/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias (.env.local).');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
