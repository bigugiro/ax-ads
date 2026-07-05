import { describe, expect, it } from 'vitest';
import {
  derivarResumo,
  janelaAnterior,
  montarDashboard,
  resumirLinhas,
  somarTotais,
  variacaoNullable,
  variacaoPct,
  type CampanhaMeta,
  type MetricaCampanhaDia,
  type MetricaLinhaBruta,
} from './metricas';

const linha = (p: Partial<MetricaLinhaBruta>): MetricaLinhaBruta => ({
  impressoes: 0,
  cliques: 0,
  gasto: 0,
  conversoes: 0,
  receita: 0,
  ...p,
});

describe('somarTotais', () => {
  it('soma colunas cruas e estabiliza dinheiro em 2 casas', () => {
    const t = somarTotais([
      linha({ impressoes: 100, cliques: 5, gasto: 0.1, conversoes: 1, receita: 0.2 }),
      linha({ impressoes: 200, cliques: 7, gasto: 0.2, conversoes: 2, receita: 0.1 }),
    ]);
    expect(t).toEqual({ impressoes: 300, cliques: 12, gasto: 0.3, conversoes: 3, receita: 0.3 });
  });

  it('lista vazia → tudo zero', () => {
    expect(somarTotais([])).toEqual({
      impressoes: 0,
      cliques: 0,
      gasto: 0,
      conversoes: 0,
      receita: 0,
    });
  });
});

describe('derivarResumo', () => {
  it('deriva razões sobre os totais (não média de razões)', () => {
    const r = derivarResumo({
      impressoes: 1000,
      cliques: 20,
      gasto: 100,
      conversoes: 4,
      receita: 500,
    });
    expect(r.ctr).toBe(0.02); // 20/1000
    expect(r.cpc).toBe(5); // 100/20
    expect(r.cpa).toBe(25); // 100/4  (CAC)
    expect(r.roas).toBe(5); // 500/100
    expect(r.ticketMedio).toBe(125); // 500/4
  });

  it('protege divisões por zero com null (e ctr 0 sem impressões)', () => {
    const r = derivarResumo({
      impressoes: 0,
      cliques: 0,
      gasto: 0,
      conversoes: 0,
      receita: 0,
    });
    expect(r.ctr).toBe(0);
    expect(r.cpc).toBeNull();
    expect(r.cpa).toBeNull();
    expect(r.roas).toBeNull();
    expect(r.ticketMedio).toBeNull();
  });

  it('CTR agregado pondera pelo volume (média de razões daria outro número)', () => {
    // Anúncio A: 1 clique / 10 imp (10%); B: 10 cliques / 1000 imp (1%).
    // Média simples das razões = 5.5%. Ponderado correto = 11/1010 ≈ 1.089%.
    const r = resumirLinhas([
      linha({ impressoes: 10, cliques: 1 }),
      linha({ impressoes: 1000, cliques: 10 }),
    ]);
    expect(r.ctr).toBeCloseTo(11 / 1010, 6);
    expect(r.ctr).not.toBeCloseTo(0.055, 3);
  });
});

describe('variacao', () => {
  it('percentual relativo à base', () => {
    expect(variacaoPct(150, 100)).toBe(0.5);
    expect(variacaoPct(80, 100)).toBe(-0.2);
  });

  it('base zero → null (crescimento indefinido)', () => {
    expect(variacaoPct(50, 0)).toBeNull();
  });

  it('nullable propaga null de qualquer lado', () => {
    expect(variacaoNullable(2, null)).toBeNull();
    expect(variacaoNullable(null, 2)).toBeNull();
    expect(variacaoNullable(3, 2)).toBe(0.5);
  });
});

describe('janelaAnterior', () => {
  it('devolve a janela imediatamente anterior de mesma duração', () => {
    expect(janelaAnterior({ inicio: '2026-06-06', fim: '2026-07-05' })).toEqual({
      inicio: '2026-05-07',
      fim: '2026-06-05',
    });
  });

  it('janela de 1 dia → o dia anterior', () => {
    expect(janelaAnterior({ inicio: '2026-07-05', fim: '2026-07-05' })).toEqual({
      inicio: '2026-07-04',
      fim: '2026-07-04',
    });
  });

  it('atravessa virada de mês/ano corretamente', () => {
    expect(janelaAnterior({ inicio: '2026-01-01', fim: '2026-01-07' })).toEqual({
      inicio: '2025-12-25',
      fim: '2025-12-31',
    });
  });
});

describe('montarDashboard', () => {
  const campanhas: CampanhaMeta[] = [
    { id: 'c1', nome: 'ASC Fundo', status: 'ativa', clienteId: 'cli1', clienteNome: 'Aurora' },
    { id: 'c2', nome: 'TOFU', status: 'ativa', clienteId: 'cli1', clienteNome: 'Aurora' },
    { id: 'c3', nome: 'Search', status: 'pausada', clienteId: 'cli2', clienteNome: 'TechShop' },
  ];
  const m = (
    campanhaId: string,
    data: string,
    p: Partial<MetricaLinhaBruta>,
  ): MetricaCampanhaDia => ({
    campanhaId,
    data,
    ...linha(p),
  });

  it('agrega geral, por cliente e por campanha sem contar em dobro', () => {
    const dash = montarDashboard({
      periodo: { inicio: '2026-07-01', fim: '2026-07-02' },
      periodoAnterior: { inicio: '2026-06-29', fim: '2026-06-30' },
      campanhas,
      metricasAtual: [
        m('c1', '2026-07-01', {
          impressoes: 1000,
          cliques: 20,
          gasto: 100,
          conversoes: 5,
          receita: 600,
        }),
        m('c1', '2026-07-02', {
          impressoes: 1000,
          cliques: 20,
          gasto: 100,
          conversoes: 5,
          receita: 400,
        }),
        m('c2', '2026-07-01', {
          impressoes: 500,
          cliques: 5,
          gasto: 50,
          conversoes: 1,
          receita: 90,
        }),
        m('c3', '2026-07-02', {
          impressoes: 200,
          cliques: 4,
          gasto: 40,
          conversoes: 2,
          receita: 200,
        }),
      ],
      metricasAnterior: [
        m('c1', '2026-06-29', {
          impressoes: 800,
          cliques: 16,
          gasto: 80,
          conversoes: 4,
          receita: 320,
        }),
      ],
    });

    expect(dash.geral.atual.gasto).toBe(290); // 100+100+50+40
    expect(dash.geral.atual.receita).toBe(1290);
    expect(dash.geral.atual.roas).toBeCloseTo(1290 / 290, 4);
    expect(dash.geral.anterior.gasto).toBe(80);
    // Variação de gasto: (290-80)/80 = 2.625
    expect(dash.geral.variacao.gasto).toBe(2.625);

    // Por cliente: Aurora (c1+c2) = 250 de gasto; TechShop (c3) = 40.
    const aurora = dash.porCliente.find((c) => c.clienteId === 'cli1');
    expect(aurora?.resumo.gasto).toBe(250);
    expect(dash.porCliente[0]?.clienteId).toBe('cli1'); // maior gasto primeiro

    // Por campanha: c1 = 200, aparece primeiro.
    expect(dash.porCampanha[0]?.campanhaId).toBe('c1');
    expect(dash.porCampanha.find((c) => c.campanhaId === 'c1')?.resumo.gasto).toBe(200);

    // Série diária agregada e ordenada.
    expect(dash.serie).toEqual([
      { data: '2026-07-01', gasto: 150, receita: 690, conversoes: 6 },
      { data: '2026-07-02', gasto: 140, receita: 600, conversoes: 7 },
    ]);
  });

  it('semeia clientes/campanhas sem métrica com resumo zero', () => {
    const dash = montarDashboard({
      periodo: { inicio: '2026-07-01', fim: '2026-07-01' },
      periodoAnterior: { inicio: '2026-06-30', fim: '2026-06-30' },
      campanhas,
      metricasAtual: [],
      metricasAnterior: [],
    });
    expect(dash.porCampanha).toHaveLength(3);
    expect(dash.porCliente).toHaveLength(2);
    expect(dash.geral.atual.gasto).toBe(0);
    expect(dash.geral.atual.roas).toBeNull();
    expect(dash.serie).toEqual([]);
  });

  it('ignora métrica de campanha desconhecida (fora do espelho)', () => {
    const dash = montarDashboard({
      periodo: { inicio: '2026-07-01', fim: '2026-07-01' },
      periodoAnterior: { inicio: '2026-06-30', fim: '2026-06-30' },
      campanhas,
      metricasAtual: [m('fantasma', '2026-07-01', { gasto: 999, receita: 999 })],
      metricasAnterior: [],
    });
    expect(dash.geral.atual.gasto).toBe(0);
    expect(dash.serie).toEqual([]);
  });
});
