import { describe, expect, it } from 'vitest';
import { PRECOS_PLANO, formatarPrecoPlano } from './billing';

describe('PRECOS_PLANO (puro)', () => {
  it('free não cobra', () => {
    expect(PRECOS_PLANO.free).toBe(0);
  });

  it('planos pagos têm preço crescente por tier', () => {
    expect(PRECOS_PLANO.starter).toBeGreaterThan(0);
    expect(PRECOS_PLANO.pro).toBeGreaterThan(PRECOS_PLANO.starter);
    expect(PRECOS_PLANO.agency).toBeGreaterThan(PRECOS_PLANO.pro);
  });
});

describe('formatarPrecoPlano', () => {
  it('formata centavos como moeda BRL', () => {
    expect(formatarPrecoPlano('free')).toContain('0,00');
    expect(formatarPrecoPlano('starter')).toBe(
      (PRECOS_PLANO.starter / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    );
  });
});
