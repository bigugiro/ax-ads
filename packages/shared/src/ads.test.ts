import { describe, expect, it } from 'vitest';
import {
  atualizarCampanhaSchema,
  atualizarContaSchema,
  conectarContaSchema,
  isoDateSchema,
  listarContasQuerySchema,
  plataformaSchema,
} from './ads';

const UUID = '3f9a2c4e-8b1d-4f6a-9c3e-2d5b7a891234';

describe('conectarContaSchema', () => {
  it('aceita payload válido', () => {
    const r = conectarContaSchema.safeParse({
      cliente_id: UUID,
      plataforma: 'demo',
      external_account_id: 'demo-acc-aurora',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita plataforma desconhecida e ids inválidos', () => {
    expect(
      conectarContaSchema.safeParse({
        cliente_id: UUID,
        plataforma: 'tiktok',
        external_account_id: 'x',
      }).success,
    ).toBe(false);
    expect(
      conectarContaSchema.safeParse({
        cliente_id: 'nao-e-uuid',
        plataforma: 'demo',
        external_account_id: 'x',
      }).success,
    ).toBe(false);
    expect(conectarContaSchema.safeParse({ cliente_id: UUID, plataforma: 'demo' }).success).toBe(
      false,
    );
  });
});

describe('atualizarContaSchema', () => {
  it('só permite pausar/reativar — nunca "desconectada" via PATCH', () => {
    expect(atualizarContaSchema.safeParse({ status: 'ativa' }).success).toBe(true);
    expect(atualizarContaSchema.safeParse({ status: 'pausada' }).success).toBe(true);
    expect(atualizarContaSchema.safeParse({ status: 'desconectada' }).success).toBe(false);
  });
});

describe('atualizarCampanhaSchema', () => {
  it('aceita status e/ou budget, exige ao menos um', () => {
    expect(atualizarCampanhaSchema.safeParse({ status: 'pausada' }).success).toBe(true);
    expect(atualizarCampanhaSchema.safeParse({ budget: 120 }).success).toBe(true);
    expect(atualizarCampanhaSchema.safeParse({ status: 'ativa', budget: 80 }).success).toBe(true);
    expect(atualizarCampanhaSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita status inválido e budget não-positivo', () => {
    expect(atualizarCampanhaSchema.safeParse({ status: 'arquivada' }).success).toBe(false);
    expect(atualizarCampanhaSchema.safeParse({ budget: 0 }).success).toBe(false);
    expect(atualizarCampanhaSchema.safeParse({ budget: -10 }).success).toBe(false);
  });
});

describe('listarContasQuerySchema', () => {
  it('cliente_id é opcional, mas precisa ser uuid quando vier', () => {
    expect(listarContasQuerySchema.safeParse({}).success).toBe(true);
    expect(listarContasQuerySchema.safeParse({ cliente_id: UUID }).success).toBe(true);
    expect(listarContasQuerySchema.safeParse({ cliente_id: '123' }).success).toBe(false);
  });
});

describe('primitivos', () => {
  it('isoDateSchema valida YYYY-MM-DD', () => {
    expect(isoDateSchema.safeParse('2026-07-04').success).toBe(true);
    expect(isoDateSchema.safeParse('04/07/2026').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-7-4').success).toBe(false);
  });

  it('plataformaSchema cobre demo, meta e google', () => {
    for (const p of ['demo', 'meta', 'google']) {
      expect(plataformaSchema.safeParse(p).success).toBe(true);
    }
    expect(plataformaSchema.safeParse('bing').success).toBe(false);
  });
});
