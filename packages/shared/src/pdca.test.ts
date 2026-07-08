import { describe, expect, it } from 'vitest';
import { detectarAnomalias, mereceRecomendacao } from './pdca';
import type { MetricasResumo } from './metricas';

const resumo = (p: Partial<MetricasResumo>): MetricasResumo => ({
  impressoes: 0,
  cliques: 0,
  gasto: 0,
  conversoes: 0,
  receita: 0,
  ctr: 0,
  cpc: null,
  cpa: null,
  roas: null,
  ticketMedio: null,
  ...p,
});

describe('detectarAnomalias (Check do PDCA — puro)', () => {
  it('sem anomalia quando CPA e ROAS se mantêm estáveis', () => {
    const anterior = resumo({ conversoes: 10, cpa: 50, roas: 4 });
    const atual = resumo({ conversoes: 10, cpa: 52, roas: 3.9 }); // variação pequena
    expect(detectarAnomalias(atual, anterior)).toEqual([]);
  });

  it('CPA subir 42% dispara anomalia média', () => {
    const anterior = resumo({ conversoes: 10, cpa: 50 });
    const atual = resumo({ conversoes: 10, cpa: 71 }); // +42%
    const anomalias = detectarAnomalias(atual, anterior);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]).toMatchObject({ metrica: 'cpa', severidade: 'media' });
    expect(anomalias[0]!.variacaoPct).toBeCloseTo(0.42, 2);
  });

  it('CPA subir 60%+ dispara anomalia alta', () => {
    const anterior = resumo({ conversoes: 10, cpa: 50 });
    const atual = resumo({ conversoes: 10, cpa: 85 }); // +70%
    const anomalias = detectarAnomalias(atual, anterior);
    expect(anomalias[0]).toMatchObject({ metrica: 'cpa', severidade: 'alta' });
  });

  it('ROAS cair dispara anomalia (queda é ruim, alta é boa)', () => {
    const anterior = resumo({ conversoes: 10, roas: 5 });
    const atual = resumo({ conversoes: 10, roas: 3 }); // -40%
    const anomalias = detectarAnomalias(atual, anterior);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]).toMatchObject({ metrica: 'roas', severidade: 'media' });
  });

  it('ROAS subir NÃO é anomalia — é uma boa notícia', () => {
    const anterior = resumo({ conversoes: 10, roas: 3 });
    const atual = resumo({ conversoes: 10, roas: 6 }); // dobrou, mas pra melhor
    expect(detectarAnomalias(atual, anterior)).toEqual([]);
  });

  it('CPA cair NÃO é anomalia — é uma boa notícia', () => {
    const anterior = resumo({ conversoes: 10, cpa: 50 });
    const atual = resumo({ conversoes: 10, cpa: 20 });
    expect(detectarAnomalias(atual, anterior)).toEqual([]);
  });

  it('ignora quando a base anterior tem poucas conversões (ruído estatístico)', () => {
    const anterior = resumo({ conversoes: 2, cpa: 50 }); // abaixo do piso de 3
    const atual = resumo({ conversoes: 2, cpa: 200 }); // +300%, mas base instável
    expect(detectarAnomalias(atual, anterior)).toEqual([]);
  });

  it('ignora quando não há CPA/ROAS em algum dos períodos (sem conversão/gasto)', () => {
    const anterior = resumo({ conversoes: 5, cpa: null, roas: null });
    const atual = resumo({ conversoes: 5, cpa: 100, roas: 2 });
    expect(detectarAnomalias(atual, anterior)).toEqual([]);
  });

  it('detecta CPA e ROAS ao mesmo tempo quando ambos pioram', () => {
    const anterior = resumo({ conversoes: 10, cpa: 50, roas: 5 });
    const atual = resumo({ conversoes: 10, cpa: 90, roas: 2 }); // +80% / -60%
    const anomalias = detectarAnomalias(atual, anterior);
    expect(anomalias.map((a) => a.metrica).sort()).toEqual(['cpa', 'roas']);
    expect(anomalias.every((a) => a.severidade === 'alta')).toBe(true);
  });
});

describe('mereceRecomendacao', () => {
  it('só média e alta escalam para recomendação — baixa fica só informativa', () => {
    expect(mereceRecomendacao('baixa')).toBe(false);
    expect(mereceRecomendacao('media')).toBe(true);
    expect(mereceRecomendacao('alta')).toBe(true);
  });
});
