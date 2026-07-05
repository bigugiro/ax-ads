/** Cliente HTTP da API AX Ads: injeta o JWT Supabase e normaliza erros. */
import { apiUrl, supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GET autenticado; devolve `data` do envelope `{ data }`. Lança `ApiError` em falha. */
export async function apiGet<T>(path: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new ApiError(401, 'Sessão expirada — entre novamente.');

  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let mensagem = `Erro ${res.status}`;
    try {
      const corpo = (await res.json()) as { error?: string };
      if (corpo.error) mensagem = corpo.error;
    } catch {
      // corpo não-JSON: mantém a mensagem genérica
    }
    throw new ApiError(res.status, mensagem);
  }

  const corpo = (await res.json()) as { data: T };
  return corpo.data;
}
