/**
 * Contrato do `AdsProvider` provado sobre o DemoProvider (DoD do Sprint 1).
 * O que vale aqui vale para Meta/Google nos Sprints 11–12: mesma interface,
 * mesmas invariantes (hierarquia íntegra, funil coerente, ações refletidas).
 */
import type { ProviderMetricaDiaria } from '@ax-ads/shared';
import { describe, expect, it } from 'vitest';
import { DemoProvider } from './demo';

const ACC = 'demo-acc-aurora';
// 90 dias fechados: 2026-04-01 → 2026-06-29 (30 + 31 + 29).
const PERIODO_90 = { inicio: '2026-04-01', fim: '2026-06-29' };
const PERIODO_CURTO = { inicio: '2026-06-01', fim: '2026-06-14' };

describe('DemoProvider — contas', () => {
  it('lista contas curadas com moeda e nome', async () => {
    const contas = await new DemoProvider().listarContas();
    expect(contas.length).toBeGreaterThanOrEqual(3);
    for (const c of contas) {
      expect(c.externalAccountId).toMatch(/^demo-acc-/);
      expect(c.nome.length).toBeGreaterThan(0);
      expect(c.moeda).toHaveLength(3);
    }
  });

  it('busca conta existente e retorna null para inexistente', async () => {
    const provider = new DemoProvider();
    const conta = await provider.buscarConta(ACC);
    expect(conta?.externalAccountId).toBe(ACC);
    expect(await provider.buscarConta('demo-acc-nao-existe')).toBeNull();
  });
});

describe('DemoProvider — estrutura da conta', () => {
  it('gera campanhas de funil completo com budget positivo', async () => {
    const campanhas = await new DemoProvider().listarCampanhas(ACC);
    expect(campanhas.length).toBeGreaterThanOrEqual(4);
    const objetivos = new Set(campanhas.map((c) => c.objetivo));
    // Funil e-commerce: topo (reconhecimento), fundo (vendas) e retargeting.
    expect(objetivos.has('reconhecimento')).toBe(true);
    expect(objetivos.has('vendas')).toBe(true);
    expect(objetivos.has('vendas_retargeting')).toBe(true);
    for (const c of campanhas) {
      expect(c.budget).toBeGreaterThan(0);
      expect(c.budgetTipo).toBe('diario');
    }
  });

  it('hierarquia íntegra: conjunto → campanha e anúncio → conjunto', async () => {
    const provider = new DemoProvider();
    const campanhas = await provider.listarCampanhas(ACC);
    const conjuntos = await provider.listarConjuntos(ACC);
    const anuncios = await provider.listarAnuncios(ACC);

    const idsCampanha = new Set(campanhas.map((c) => c.externalId));
    const idsConjunto = new Set(conjuntos.map((cj) => cj.externalId));

    expect(conjuntos.length).toBeGreaterThan(0);
    expect(anuncios.length).toBeGreaterThan(0);
    for (const cj of conjuntos) expect(idsCampanha.has(cj.campanhaExternalId)).toBe(true);
    for (const an of anuncios) expect(idsConjunto.has(an.conjuntoExternalId)).toBe(true);
  });

  it('ASC usa CBO: budget do conjunto fica null; demais têm budget próprio', async () => {
    const provider = new DemoProvider();
    const campanhas = await provider.listarCampanhas(ACC);
    const conjuntos = await provider.listarConjuntos(ACC);
    const porCampanha = new Map(campanhas.map((c) => [c.externalId, c]));
    for (const cj of conjuntos) {
      const campanha = porCampanha.get(cj.campanhaExternalId);
      if (campanha?.objetivo === 'vendas') expect(cj.budget).toBeNull();
      else expect(cj.budget).toBeGreaterThan(0);
    }
  });
});

describe('DemoProvider — métricas diárias', () => {
  it('cobre os 90 dias sem buracos, nos três níveis', async () => {
    const provider = new DemoProvider();
    const metricas = await provider.listarMetricasDiarias(ACC, PERIODO_90);
    const campanhas = await provider.listarCampanhas(ACC);

    const datas = new Set(metricas.map((m) => m.data));
    expect(datas.size).toBe(90);
    expect([...datas].every((d) => d >= PERIODO_90.inicio && d <= PERIODO_90.fim)).toBe(true);

    for (const tipo of ['campanha', 'conjunto', 'anuncio'] as const) {
      expect(metricas.some((m) => m.entidadeTipo === tipo)).toBe(true);
    }
    // Cada campanha tem exatamente 1 linha por dia.
    for (const c of campanhas) {
      const linhas = metricas.filter(
        (m) => m.entidadeTipo === 'campanha' && m.entidadeExternalId === c.externalId,
      );
      expect(linhas).toHaveLength(90);
    }
  });

  it('funil coerente em toda linha: cliques ≤ impressões, conversões ≤ cliques', async () => {
    const metricas = await new DemoProvider().listarMetricasDiarias(ACC, PERIODO_CURTO);
    expect(metricas.length).toBeGreaterThan(0);
    for (const m of metricas) {
      expect(Number.isInteger(m.impressoes)).toBe(true);
      expect(Number.isInteger(m.cliques)).toBe(true);
      expect(Number.isInteger(m.conversoes)).toBe(true);
      expect(m.cliques).toBeLessThanOrEqual(m.impressoes);
      expect(m.conversoes).toBeLessThanOrEqual(m.cliques);
      expect(m.gasto).toBeGreaterThanOrEqual(0);
      expect(m.receita).toBeGreaterThanOrEqual(0);
      if (m.conversoes > 0) expect(m.receita).toBeGreaterThan(0);
    }
  });

  it('agregação bate: campanha = Σ conjuntos = Σ anúncios (por dia)', async () => {
    const provider = new DemoProvider();
    const metricas = await provider.listarMetricasDiarias(ACC, {
      inicio: '2026-06-10',
      fim: '2026-06-10',
    });
    const soma = (linhas: ProviderMetricaDiaria[]) =>
      linhas.reduce(
        (acc, m) => ({
          impressoes: acc.impressoes + m.impressoes,
          cliques: acc.cliques + m.cliques,
          conversoes: acc.conversoes + m.conversoes,
          gasto: acc.gasto + m.gasto,
          receita: acc.receita + m.receita,
        }),
        { impressoes: 0, cliques: 0, conversoes: 0, gasto: 0, receita: 0 },
      );

    const porTipo = (tipo: ProviderMetricaDiaria['entidadeTipo']) =>
      metricas.filter((m) => m.entidadeTipo === tipo);

    const deCampanhas = soma(porTipo('campanha'));
    const deConjuntos = soma(porTipo('conjunto'));
    const deAnuncios = soma(porTipo('anuncio'));

    expect(deCampanhas.impressoes).toBe(deConjuntos.impressoes);
    expect(deCampanhas.impressoes).toBe(deAnuncios.impressoes);
    expect(deCampanhas.cliques).toBe(deAnuncios.cliques);
    expect(deCampanhas.conversoes).toBe(deAnuncios.conversoes);
    expect(deCampanhas.gasto).toBeCloseTo(deAnuncios.gasto, 1);
    expect(deCampanhas.receita).toBeCloseTo(deAnuncios.receita, 1);
  });

  it('sazonalidade: fim de semana rende mais impressões que seg/ter', async () => {
    const metricas = await new DemoProvider().listarMetricasDiarias(ACC, PERIODO_90);
    const doDia = (dias: number[]) =>
      metricas.filter(
        (m) =>
          m.entidadeTipo === 'campanha' &&
          dias.includes(new Date(`${m.data}T00:00:00Z`).getUTCDay()),
      );
    const media = (linhas: ProviderMetricaDiaria[]) =>
      linhas.reduce((s, m) => s + m.impressoes, 0) / Math.max(1, linhas.length);

    expect(media(doDia([6, 0]))).toBeGreaterThan(media(doDia([1, 2]))); // sáb/dom > seg/ter
  });

  it('período invertido ou inválido retorna vazio', async () => {
    const provider = new DemoProvider();
    expect(
      await provider.listarMetricasDiarias(ACC, { inicio: '2026-06-10', fim: '2026-06-01' }),
    ).toEqual([]);
    expect(
      await provider.listarMetricasDiarias(ACC, { inicio: 'data-torta', fim: '2026-06-01' }),
    ).toEqual([]);
  });

  it('determinístico: instâncias independentes geram dados idênticos', async () => {
    const a = new DemoProvider();
    const b = new DemoProvider();
    expect(await a.listarCampanhas(ACC)).toEqual(await b.listarCampanhas(ACC));
    expect(await a.listarConjuntos(ACC)).toEqual(await b.listarConjuntos(ACC));
    expect(await a.listarAnuncios(ACC)).toEqual(await b.listarAnuncios(ACC));
    expect(await a.listarMetricasDiarias(ACC, PERIODO_CURTO)).toEqual(
      await b.listarMetricasDiarias(ACC, PERIODO_CURTO),
    );
  });

  it('contas diferentes geram dados diferentes', async () => {
    const provider = new DemoProvider();
    const aurora = await provider.listarMetricasDiarias('demo-acc-aurora', PERIODO_CURTO);
    const moda = await provider.listarMetricasDiarias('demo-acc-modabella', PERIODO_CURTO);
    expect(aurora).not.toEqual(moda);
  });
});

describe('DemoProvider — ações', () => {
  it('pausar campanha reflete na leitura seguinte', async () => {
    const provider = new DemoProvider();
    const [campanha] = await provider.listarCampanhas(ACC);
    expect(campanha).toBeDefined();
    if (!campanha) return;

    await provider.atualizarStatusCampanha(ACC, campanha.externalId, 'pausada');
    const depois = await provider.listarCampanhas(ACC);
    expect(depois.find((c) => c.externalId === campanha.externalId)?.status).toBe('pausada');

    await provider.atualizarStatusCampanha(ACC, campanha.externalId, 'ativa');
    const reativada = await provider.listarCampanhas(ACC);
    expect(reativada.find((c) => c.externalId === campanha.externalId)?.status).toBe('ativa');
  });

  it('ajustar budget reflete na leitura seguinte', async () => {
    const provider = new DemoProvider();
    const [campanha] = await provider.listarCampanhas(ACC);
    if (!campanha) throw new Error('conta demo sem campanhas');

    await provider.atualizarBudgetCampanha(ACC, campanha.externalId, 999.5);
    const depois = await provider.listarCampanhas(ACC);
    expect(depois.find((c) => c.externalId === campanha.externalId)?.budget).toBe(999.5);
  });

  it('rejeita campanha inexistente e budget não-positivo', async () => {
    const provider = new DemoProvider();
    await expect(provider.atualizarStatusCampanha(ACC, 'cmp-fantasma', 'pausada')).rejects.toThrow(
      /não existe/,
    );
    const [campanha] = await provider.listarCampanhas(ACC);
    if (!campanha) throw new Error('conta demo sem campanhas');
    await expect(provider.atualizarBudgetCampanha(ACC, campanha.externalId, 0)).rejects.toThrow(
      /positivo/,
    );
  });
});
