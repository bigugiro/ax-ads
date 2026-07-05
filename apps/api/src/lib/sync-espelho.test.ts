import type { ProviderMetricaDiaria } from '@ax-ads/shared';
import { describe, expect, it } from 'vitest';
import { chaveEntidade, chunk, mapearMetricasParaLinhas, periodoUltimosDias } from './sync-espelho';

describe('chunk', () => {
  it('divide em blocos do tamanho pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('rejeita tamanho inválido', () => {
    expect(() => chunk([1], 0)).toThrow(/positivo/);
    expect(() => chunk([1], -2)).toThrow(/positivo/);
    expect(() => chunk([1], 1.5)).toThrow(/positivo/);
  });
});

describe('chaveEntidade', () => {
  it('compõe tipo e id externo', () => {
    expect(chaveEntidade('campanha', 'cmp-1')).toBe('campanha|cmp-1');
    expect(chaveEntidade('anuncio', 'ad-9')).toBe('anuncio|ad-9');
  });
});

describe('periodoUltimosDias', () => {
  it('fecha em ontem (UTC) e abre `dias` dias antes', () => {
    const hoje = new Date('2026-07-04T15:30:00Z');
    expect(periodoUltimosDias(90, hoje)).toEqual({ inicio: '2026-04-05', fim: '2026-07-03' });
    expect(periodoUltimosDias(1, hoje)).toEqual({ inicio: '2026-07-03', fim: '2026-07-03' });
  });

  it('vira mês/ano corretamente', () => {
    expect(periodoUltimosDias(7, new Date('2026-01-01T02:00:00Z'))).toEqual({
      inicio: '2025-12-25',
      fim: '2025-12-31',
    });
  });

  it('rejeita quantidade inválida de dias', () => {
    expect(() => periodoUltimosDias(0)).toThrow(/positivo/);
    expect(() => periodoUltimosDias(2.5)).toThrow(/positivo/);
  });
});

describe('mapearMetricasParaLinhas', () => {
  const metrica = (over: Partial<ProviderMetricaDiaria>): ProviderMetricaDiaria => ({
    entidadeTipo: 'campanha',
    entidadeExternalId: 'cmp-1',
    data: '2026-06-01',
    impressoes: 1000,
    cliques: 20,
    gasto: 35.5,
    conversoes: 2,
    receita: 240.9,
    ...over,
  });

  it('traduz id externo → id local e carimba a agência', () => {
    const ids = new Map([['campanha|cmp-1', 'uuid-local-1']]);
    const { linhas, semEspelho } = mapearMetricasParaLinhas('ag-1', [metrica({})], ids);

    expect(semEspelho).toBe(0);
    expect(linhas).toEqual([
      {
        agencia_id: 'ag-1',
        entidade_tipo: 'campanha',
        entidade_id: 'uuid-local-1',
        data: '2026-06-01',
        impressoes: 1000,
        cliques: 20,
        gasto: 35.5,
        conversoes: 2,
        receita: 240.9,
      },
    ]);
  });

  it('não deixa métrica órfã passar em silêncio', () => {
    const ids = new Map([['campanha|cmp-1', 'uuid-local-1']]);
    const { linhas, semEspelho } = mapearMetricasParaLinhas(
      'ag-1',
      [metrica({}), metrica({ entidadeExternalId: 'cmp-fantasma' })],
      ids,
    );
    expect(linhas).toHaveLength(1);
    expect(semEspelho).toBe(1);
  });
});
