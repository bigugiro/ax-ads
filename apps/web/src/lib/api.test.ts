import { describe, expect, it, vi } from 'vitest';
import { criarApi, ErroApi } from './api';

function respostaFake(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

describe('criarApi.get', () => {
  it('desembrulha { data } e anexa o Authorization com o token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaFake(200, { data: { gasto: 10 } }));
    const api = criarApi({
      baseUrl: 'http://api.test',
      obterToken: () => Promise.resolve('jwt-123'),
      fetchImpl,
    });

    const r = await api.get<{ gasto: number }>('/metricas');
    expect(r).toEqual({ gasto: 10 });

    const [urlChamada, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(urlChamada).toBe('http://api.test/metricas');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
  });

  it('sem token não envia Authorization', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaFake(200, { data: null }));
    const api = criarApi({
      baseUrl: 'http://api.test',
      obterToken: () => Promise.resolve(null),
      fetchImpl,
    });

    await api.get('/metricas');
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('monta a query string e ignora parâmetros undefined', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaFake(200, { data: [] }));
    const api = criarApi({
      baseUrl: 'http://api.test',
      obterToken: () => Promise.resolve(null),
      fetchImpl,
    });

    await api.get('/metricas', { cliente_id: 'abc', inicio: undefined, ativo: true });
    const [urlChamada] = fetchImpl.mock.calls[0] as [string];
    expect(urlChamada).toBe('http://api.test/metricas?cliente_id=abc&ativo=true');
  });

  it('lança ErroApi com status e mensagem da API em resposta não-ok', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaFake(404, { error: 'Cliente não encontrado' }));
    const api = criarApi({
      baseUrl: 'http://api.test',
      obterToken: () => Promise.resolve('jwt'),
      fetchImpl,
    });

    await expect(api.get('/clientes/x/campanhas')).rejects.toBeInstanceOf(ErroApi);
    const erro = await api.get('/clientes/x/campanhas').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(404);
    expect((erro as ErroApi).message).toBe('Cliente não encontrado');
  });

  it('remove barra final da baseUrl', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaFake(200, { data: { status: 'ok' } }));
    const api = criarApi({
      baseUrl: 'http://api.test/',
      obterToken: () => Promise.resolve(null),
      fetchImpl,
    });

    await api.get('/health');
    const [urlChamada] = fetchImpl.mock.calls[0] as [string];
    expect(urlChamada).toBe('http://api.test/health');
  });
});
