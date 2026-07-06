import { describe, expect, it } from 'vitest';
import {
  atualizarChecklistItemSchema,
  atualizarEstrategiaAplicadaSchema,
  canalEstrategiaSchema,
  impactoEstrategiaSchema,
  listarEstrategiasQuerySchema,
} from './estrategias';

describe('canalEstrategiaSchema / impactoEstrategiaSchema', () => {
  it('cobre os valores do catálogo (Seção 6.4)', () => {
    for (const c of ['meta', 'google', 'ambos']) {
      expect(canalEstrategiaSchema.safeParse(c).success).toBe(true);
    }
    expect(canalEstrategiaSchema.safeParse('tiktok').success).toBe(false);

    for (const i of ['cac_down', 'roas_up', 'faturamento_up']) {
      expect(impactoEstrategiaSchema.safeParse(i).success).toBe(true);
    }
    expect(impactoEstrategiaSchema.safeParse('magico').success).toBe(false);
  });
});

describe('listarEstrategiasQuerySchema', () => {
  it('filtros de canal/nível são opcionais', () => {
    expect(listarEstrategiasQuerySchema.safeParse({}).success).toBe(true);
    expect(listarEstrategiasQuerySchema.safeParse({ canal: 'meta' }).success).toBe(true);
    expect(listarEstrategiasQuerySchema.safeParse({ nivel: 'avancado' }).success).toBe(true);
    expect(listarEstrategiasQuerySchema.safeParse({ canal: 'bing' }).success).toBe(false);
  });
});

describe('atualizarEstrategiaAplicadaSchema', () => {
  it('aceita status e/ou notas, exige ao menos um', () => {
    expect(atualizarEstrategiaAplicadaSchema.safeParse({ status: 'pausada' }).success).toBe(true);
    expect(atualizarEstrategiaAplicadaSchema.safeParse({ notas: 'ok' }).success).toBe(true);
    expect(atualizarEstrategiaAplicadaSchema.safeParse({ notas: null }).success).toBe(true);
    expect(atualizarEstrategiaAplicadaSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita status fora do enum', () => {
    expect(atualizarEstrategiaAplicadaSchema.safeParse({ status: 'arquivada' }).success).toBe(
      false,
    );
  });
});

describe('atualizarChecklistItemSchema', () => {
  it('exige feito booleano', () => {
    expect(atualizarChecklistItemSchema.safeParse({ feito: true }).success).toBe(true);
    expect(atualizarChecklistItemSchema.safeParse({ feito: false }).success).toBe(true);
    expect(atualizarChecklistItemSchema.safeParse({}).success).toBe(false);
    expect(atualizarChecklistItemSchema.safeParse({ feito: 'sim' }).success).toBe(false);
  });
});
