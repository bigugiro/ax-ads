import { describe, expect, it } from 'vitest';
import {
  agregarPorChave,
  derivarMetricas,
  metricasQuerySchema,
  METRICAS_ZERO,
  periodoQuerySchema,
  resumirMetricas,
  somarMetricas,
  type MetricasBrutas,
} from './metricas';

const linha = (p: Partial<MetricasBrutas>): MetricasBrutas => ({ ...METRICAS_ZERO, ...p });

describe('somarMetricas', () => {
  it('soma campo a campo e ancora monetários em 2 casas', () => {
    const total = somarMetricas([
      linha({ impressoes: 100, cliques: 10, gasto: 0.1, conversoes: 1, receita: 0.2 }),
      linha({ impressoes: 50, cliques: 5, gasto: 0.2, conversoes: 2, receita: 0.1 }),
    ]);
    expect(total).toEqual({
      impressoes: 150,
      cliques: 15,
      gasto: 0.3, // 0.1 + 0.2 sem ruído de float
      conversoes: 3,
      receita: 0.3,
    });
  });

  it('lista vazia soma zero', () => {
    expect(somarMetricas([])).toEqual({ ...METRICAS_ZERO });
  });
});

describe('derivarMetricas', () => {
  it('deriva razões sobre as somas (não a média das razões)', () => {
    const d = derivarMetricas(
      linha({ impressoes: 1000, cliques: 50, gasto: 100, conversoes: 5, receita: 400 }),
    );
    expect(d.ctr).toBe(0.05); // 50/1000
    expect(d.cpc).toBe(2); // 100/50
    expect(d.cpa).toBe(20); // 100/5
    expect(d.roas).toBe(4); // 400/100
    expect(d.ticketMedio).toBe(80); // 400/5
  });

  it('CAC = CPA no Sprint 2', () => {
    const d = derivarMetricas(linha({ gasto: 90, conversoes: 3 }));
    expect(d.cac).toBe(30);
    expect(d.cac).toBe(d.cpa);
  });

  it('sem impressões: CTR 0', () => {
    expect(derivarMetricas(linha({ impressoes: 0, cliques: 0 })).ctr).toBe(0);
  });

  it('sem cliques: CPC null', () => {
    expect(derivarMetricas(linha({ gasto: 50, cliques: 0 })).cpc).toBeNull();
  });

  it('sem conversões: CPA/CAC/ticket null', () => {
    const d = derivarMetricas(linha({ gasto: 50, conversoes: 0, receita: 0 }));
    expect(d.cpa).toBeNull();
    expect(d.cac).toBeNull();
    expect(d.ticketMedio).toBeNull();
  });

  it('sem gasto: ROAS null (evita divisão por zero)', () => {
    expect(derivarMetricas(linha({ gasto: 0, receita: 100 })).roas).toBeNull();
  });

  it('arredonda ROAS a 4 casas e CTR a 6', () => {
    const d = derivarMetricas(linha({ impressoes: 3, cliques: 1, gasto: 3, receita: 10 }));
    expect(d.ctr).toBe(0.333333); // 1/3
    expect(d.roas).toBe(3.3333); // 10/3
  });
});

describe('resumirMetricas', () => {
  it('soma e deriva num passo só', () => {
    const d = resumirMetricas([
      linha({ impressoes: 500, cliques: 25, gasto: 50, conversoes: 2, receita: 200 }),
      linha({ impressoes: 500, cliques: 25, gasto: 50, conversoes: 3, receita: 300 }),
    ]);
    expect(d.impressoes).toBe(1000);
    expect(d.roas).toBe(5); // 500/100
    expect(d.cpa).toBe(20); // 100/5
  });
});

describe('agregarPorChave', () => {
  it('agrupa e soma por chave, preservando a ordem de 1ª aparição', () => {
    const itens = [
      { id: 'a', m: linha({ gasto: 10, receita: 40 }) },
      { id: 'b', m: linha({ gasto: 5, receita: 5 }) },
      { id: 'a', m: linha({ gasto: 20, receita: 60 }) },
    ];
    const grupos = agregarPorChave(
      itens,
      (i) => i.id,
      (i) => i.m,
    );
    expect([...grupos.keys()]).toEqual(['a', 'b']);
    expect(grupos.get('a')).toEqual(linha({ gasto: 30, receita: 100 }));
    expect(grupos.get('b')).toEqual(linha({ gasto: 5, receita: 5 }));
  });

  it('cada grupo pode ser derivado de forma independente', () => {
    const grupos = agregarPorChave(
      [{ k: 'x', v: linha({ impressoes: 100, cliques: 10 }) }],
      (i) => i.k,
      (i) => i.v,
    );
    expect(derivarMetricas(grupos.get('x')!).ctr).toBe(0.1);
  });
});

describe('periodoQuerySchema', () => {
  it('aceita sem período (usa default na rota)', () => {
    expect(periodoQuerySchema.safeParse({}).success).toBe(true);
  });

  it('aceita inicio e fim juntos', () => {
    const r = periodoQuerySchema.safeParse({ inicio: '2026-01-01', fim: '2026-01-31' });
    expect(r.success).toBe(true);
  });

  it('rejeita apenas um dos limites', () => {
    expect(periodoQuerySchema.safeParse({ inicio: '2026-01-01' }).success).toBe(false);
  });

  it('rejeita inicio depois de fim', () => {
    expect(periodoQuerySchema.safeParse({ inicio: '2026-02-01', fim: '2026-01-01' }).success).toBe(
      false,
    );
  });

  it('rejeita data com formato inválido', () => {
    expect(periodoQuerySchema.safeParse({ inicio: '01/01/2026', fim: '2026-01-31' }).success).toBe(
      false,
    );
  });
});

describe('metricasQuerySchema', () => {
  it('aceita cliente_id opcional com período', () => {
    const r = metricasQuerySchema.safeParse({
      cliente_id: '11111111-1111-1111-1111-111111111111',
      inicio: '2026-01-01',
      fim: '2026-01-31',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita cliente_id que não é UUID', () => {
    expect(metricasQuerySchema.safeParse({ cliente_id: 'abc' }).success).toBe(false);
  });
});
