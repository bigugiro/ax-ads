/**
 * Instância única do cliente HTTP, ligada à sessão Supabase do browser.
 * As páginas/queries importam `api` daqui; a fábrica pura vive em `api.ts`.
 */
import { criarApi } from './api';
import { apiUrl, supabase } from './supabase';

export const api = criarApi({
  baseUrl: apiUrl,
  obterToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
