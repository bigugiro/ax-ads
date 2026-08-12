/**
 * Cliente HTTP tipado para a API (apps/api).
 *
 * Fábrica PURA e injetável: o token e o `fetch` entram por parâmetro, então é
 * testável sem browser nem Supabase. A instância real, ligada à sessão
 * Supabase, fica em `api-client.ts`.
 *
 * Contrato da API: sucesso responde `{ data: ... }`; erro responde
 * `{ error: string, details?: unknown }` com o status HTTP correspondente.
 */

/** Erro de resposta da API (status HTTP + detalhe cru, quando houver). */
export class ErroApi extends Error {
  readonly status: number;
  readonly detalhe: unknown;

  constructor(status: number, message: string, detalhe?: unknown) {
    super(message);
    this.name = 'ErroApi';
    this.status = status;
    this.detalhe = detalhe;
  }
}

export type ParametrosQuery = Record<string, string | number | boolean | undefined>;

export interface OpcoesApi {
  /** Base URL da API (barras finais são ignoradas). */
  baseUrl: string;
  /** Retorna o JWT atual do usuário, ou `null` se deslogado. */
  obterToken: () => Promise<string | null>;
  /** Implementação de `fetch` (default: global). Injetável para teste. */
  fetchImpl?: typeof fetch;
}

export interface ClienteApi {
  /** GET tipado: já anexa o JWT, monta a query e desembrulha `{ data }`. */
  get<T>(caminho: string, params?: ParametrosQuery): Promise<T>;
}

function montarUrl(base: string, caminho: string, params?: ParametrosQuery): string {
  const url = new URL(`${base}${caminho}`);
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined) url.searchParams.set(chave, String(valor));
  }
  return url.toString();
}

function extrairMensagem(corpo: unknown, status: number, caminho: string): string {
  if (corpo && typeof corpo === 'object' && 'error' in corpo && typeof corpo.error === 'string') {
    return corpo.error;
  }
  return `Falha ${status} em ${caminho}`;
}

export function criarApi(opcoes: OpcoesApi): ClienteApi {
  const fetchImpl = opcoes.fetchImpl ?? globalThis.fetch;
  const base = opcoes.baseUrl.replace(/\/+$/, '');

  async function get<T>(caminho: string, params?: ParametrosQuery): Promise<T> {
    const token = await opcoes.obterToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetchImpl(montarUrl(base, caminho, params), { method: 'GET', headers });
    const corpo = (await resp.json().catch(() => null)) as unknown;

    if (!resp.ok) {
      throw new ErroApi(resp.status, extrairMensagem(corpo, resp.status, caminho), corpo);
    }
    return (corpo && typeof corpo === 'object' && 'data' in corpo ? corpo.data : corpo) as T;
  }

  return { get };
}
