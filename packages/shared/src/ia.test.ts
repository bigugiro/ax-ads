import { describe, expect, it } from 'vitest';
import {
  analisarCriativoSchema,
  classificacaoCriativoSchema,
  custoGeracao,
  gerarCopySchema,
} from './ia';

describe('custoGeracao (calculadora pura de custo)', () => {
  it('calcula o custo do Sonnet a partir dos preços por milhão de tokens', () => {
    // 1000 tokens de entrada + 500 de saída, a $3/$15 por milhão.
    const custo = custoGeracao('sonnet', 1000, 500);
    const esperado = (1000 / 1_000_000) * 3.0 + (500 / 1_000_000) * 15.0;
    expect(custo).toBeCloseTo(esperado, 6);
  });

  it('calcula o custo do Haiku a partir dos preços por milhão de tokens', () => {
    const custo = custoGeracao('haiku', 800, 200);
    const esperado = (800 / 1_000_000) * 1.0 + (200 / 1_000_000) * 5.0;
    expect(custo).toBeCloseTo(esperado, 6);
  });

  it('zero tokens custa zero', () => {
    expect(custoGeracao('sonnet', 0, 0)).toBe(0);
    expect(custoGeracao('haiku', 0, 0)).toBe(0);
  });

  it('Sonnet é mais caro que Haiku para o mesmo volume de tokens', () => {
    expect(custoGeracao('sonnet', 1000, 1000)).toBeGreaterThan(custoGeracao('haiku', 1000, 1000));
  });

  it('arredonda em 6 casas — sem drift de ponto flutuante', () => {
    const custo = custoGeracao('sonnet', 1, 1);
    expect(Number.isFinite(custo)).toBe(true);
    expect(custo.toString().replace('.', '').length).toBeLessThanOrEqual(8);
  });
});

describe('gerarCopySchema', () => {
  const base = {
    cliente_id: '3f9a2c4e-8b1d-4f6a-9c3e-2d5b7a891234',
    produto: 'Tênis de corrida',
    publico: 'Corredores amadores 25-40 anos',
  };

  it('aceita o briefing mínimo e aplica quantidade default 3', () => {
    const r = gerarCopySchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantidade).toBe(3);
  });

  it('aceita tom/oferta opcionais e quantidade customizada', () => {
    const r = gerarCopySchema.safeParse({
      ...base,
      tom: 'descontraído',
      oferta: '20% off',
      quantidade: 5,
    });
    expect(r.success).toBe(true);
  });

  it('rejeita quantidade fora da faixa 1-5', () => {
    expect(gerarCopySchema.safeParse({ ...base, quantidade: 0 }).success).toBe(false);
    expect(gerarCopySchema.safeParse({ ...base, quantidade: 6 }).success).toBe(false);
  });

  it('rejeita sem produto/publico', () => {
    expect(gerarCopySchema.safeParse({ cliente_id: base.cliente_id }).success).toBe(false);
  });
});

describe('analisarCriativoSchema', () => {
  it('exige cliente_id e texto não vazio', () => {
    expect(
      analisarCriativoSchema.safeParse({
        cliente_id: '3f9a2c4e-8b1d-4f6a-9c3e-2d5b7a891234',
        texto: 'Compre já e ganhe frete grátis',
      }).success,
    ).toBe(true);
    expect(
      analisarCriativoSchema.safeParse({
        cliente_id: '3f9a2c4e-8b1d-4f6a-9c3e-2d5b7a891234',
        texto: '',
      }).success,
    ).toBe(false);
  });
});

describe('classificacaoCriativoSchema', () => {
  it('valida a resposta estruturada da IA (ângulo, tom, força do CTA, sugestão)', () => {
    const r = classificacaoCriativoSchema.safeParse({
      angulo: 'oferta',
      tom: 'urgente',
      forca_cta: 4,
      sugestao: 'Deixe o CTA mais específico.',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita ângulo fora do enum e força do CTA fora de 1-5', () => {
    expect(
      classificacaoCriativoSchema.safeParse({
        angulo: 'inventado',
        tom: 'x',
        forca_cta: 3,
        sugestao: 'x',
      }).success,
    ).toBe(false);
    expect(
      classificacaoCriativoSchema.safeParse({
        angulo: 'dor',
        tom: 'x',
        forca_cta: 6,
        sugestao: 'x',
      }).success,
    ).toBe(false);
  });
});
