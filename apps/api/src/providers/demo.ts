/**
 * DemoProvider — implementação sintética da porta `AdsProvider` (Sprint 1).
 *
 * Gera uma conta de e-commerce realista SEM chamar plataforma nenhuma:
 * estrutura de funil (topo/meio/fundo), 60–90+ dias de métricas diárias com
 * sazonalidade (dia da semana, "quinzena do pagamento", tendência de
 * crescimento) e funil coerente (cliques ≤ impressões, conversões ≤ cliques).
 *
 * DETERMINÍSTICO: todo número deriva de hash(conta|entidade|data), então a
 * mesma conta gera sempre os mesmos dados — em qualquer processo, qualquer
 * ordem de chamada. Ações (status/budget) ficam num override em memória do
 * processo: suficiente para o contrato; a fonte de verdade do app é o
 * espelho no banco, atualizado pelo sync.
 */
import type {
  AdsProvider,
  PeriodoMetricas,
  ProviderAnuncio,
  ProviderCampanha,
  ProviderConjunto,
  ProviderConta,
  ProviderMetricaDiaria,
  StatusEntrega,
} from '@ax-ads/shared';

// ----- Aleatoriedade determinística -----

/** Hash FNV-1a de 32 bits — semente estável a partir de uma chave textual. */
function fnv1a(chave: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Número pseudo-aleatório em [0, 1) derivado só da chave (mulberry32, 1 passo). */
function rand(chave: string): number {
  let t = (fnv1a(chave) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Valor em [min, max) derivado da chave. */
function faixa(chave: string, min: number, max: number): number {
  return min + rand(chave) * (max - min);
}

// ----- Datas (UTC, formato YYYY-MM-DD) -----

function paraDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dias corridos entre a época fixa do demo e a data (para tendência). */
const EPOCA_DEMO = Date.UTC(2026, 0, 1);
function diasDesdeEpoca(iso: string): number {
  return Math.floor((paraDate(iso).getTime() - EPOCA_DEMO) / 86_400_000);
}

// ----- Universo demo (contas curadas, como um Business Manager sandbox) -----

const CONTAS_DEMO: ProviderConta[] = [
  { externalAccountId: 'demo-acc-aurora', nome: 'Aurora Cosméticos', moeda: 'BRL' },
  { externalAccountId: 'demo-acc-techshop', nome: 'TechShop Eletrônicos', moeda: 'BRL' },
  { externalAccountId: 'demo-acc-modabella', nome: 'Moda Bella', moeda: 'BRL' },
];

/** Perfil econômico de cada objetivo — governa CTR, CPC e taxa de conversão. */
interface PerfilObjetivo {
  ctrBase: number;
  cpcBase: number;
  taxaConvBase: number;
}

const PERFIL_PADRAO: PerfilObjetivo = { ctrBase: 0.018, cpcBase: 1.2, taxaConvBase: 0.035 };

const PERFIS: Record<string, PerfilObjetivo> = {
  reconhecimento: { ctrBase: 0.009, cpcBase: 0.6, taxaConvBase: 0.004 },
  trafego: { ctrBase: 0.012, cpcBase: 0.7, taxaConvBase: 0.008 },
  vendas: PERFIL_PADRAO,
  vendas_retargeting: { ctrBase: 0.022, cpcBase: 0.9, taxaConvBase: 0.045 },
  teste_criativo: { ctrBase: 0.014, cpcBase: 0.8, taxaConvBase: 0.015 },
};

/** Modelos de campanha — funil completo de e-commerce (Seção 6 do plano). */
const MODELOS_CAMPANHA = [
  {
    sufixo: 'tofu',
    nome: '[TOFU] Prospecção — Interesses amplos',
    objetivo: 'reconhecimento',
    budgetFaixa: [80, 200] as const,
    conjuntos: ['Interesses beleza & lifestyle', 'Lookalike 3% compradores'],
  },
  {
    sufixo: 'asc',
    nome: '[Fundo] Advantage+ Shopping',
    objetivo: 'vendas',
    budgetFaixa: [150, 450] as const,
    // ASC é CBO: orçamento só na campanha (budget do conjunto = null).
    conjuntos: ['ASC — catálogo completo'],
  },
  {
    sufixo: 'dpa',
    nome: '[Meio/Fundo] Retargeting dinâmico de catálogo',
    objetivo: 'vendas_retargeting',
    budgetFaixa: [60, 150] as const,
    conjuntos: ['Visitou produto 14d', 'Carrinho abandonado 7d'],
  },
  {
    sufixo: 'ugc',
    nome: '[Teste] Criativos UGC — ângulos e hooks',
    objetivo: 'teste_criativo',
    budgetFaixa: [40, 120] as const,
    conjuntos: ['UGC — teste de ângulo', 'UGC — teste de hook'],
  },
  {
    sufixo: 'trafego',
    nome: '[Topo] Tráfego — coleções novas',
    objetivo: 'trafego',
    budgetFaixa: [40, 100] as const,
    conjuntos: ['Interesses moda & tendências'],
  },
];

const NOMES_ANUNCIO = ['Carrossel produto', 'Vídeo UGC 15s', 'Estático oferta', 'Coleção catálogo'];

// Sazonalidade semanal de e-commerce: pico sex–dom, vale seg–ter.
const FATOR_DIA_SEMANA = [1.05, 0.92, 0.95, 1.0, 1.02, 1.08, 1.12]; // dom..sáb

/** Sobrescritas de ações no processo (status/budget por campanha). */
type Override = { status?: Extract<StatusEntrega, 'ativa' | 'pausada'>; budget?: number };

export class DemoProvider implements AdsProvider {
  readonly plataforma = 'demo' as const;

  private readonly overrides = new Map<string, Override>();

  // ----- Leitura -----

  listarContas(): Promise<ProviderConta[]> {
    return Promise.resolve([...CONTAS_DEMO]);
  }

  buscarConta(externalAccountId: string): Promise<ProviderConta | null> {
    const conta = CONTAS_DEMO.find((c) => c.externalAccountId === externalAccountId) ?? null;
    return Promise.resolve(conta ? { ...conta } : null);
  }

  listarCampanhas(externalAccountId: string): Promise<ProviderCampanha[]> {
    return Promise.resolve(this.gerarCampanhas(externalAccountId));
  }

  listarConjuntos(externalAccountId: string): Promise<ProviderConjunto[]> {
    return Promise.resolve(this.gerarConjuntos(externalAccountId));
  }

  listarAnuncios(externalAccountId: string): Promise<ProviderAnuncio[]> {
    const anuncios = this.gerarConjuntos(externalAccountId).flatMap((cj) =>
      this.gerarAnunciosDoConjunto(externalAccountId, cj),
    );
    return Promise.resolve(anuncios);
  }

  listarMetricasDiarias(
    externalAccountId: string,
    periodo: PeriodoMetricas,
  ): Promise<ProviderMetricaDiaria[]> {
    const inicio = paraDate(periodo.inicio);
    const fim = paraDate(periodo.fim);
    const metricas: ProviderMetricaDiaria[] = [];
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
      return Promise.resolve(metricas);
    }
    // Guarda-corpo contra períodos absurdos (evita explodir memória).
    const MAX_DIAS = 400;

    const campanhas = this.gerarCampanhas(externalAccountId);
    const conjuntos = this.gerarConjuntos(externalAccountId);
    const anunciosPorConjunto = new Map(
      conjuntos.map((cj) => [cj.externalId, this.gerarAnunciosDoConjunto(externalAccountId, cj)]),
    );

    const cursor = new Date(inicio);
    for (let dia = 0; cursor <= fim && dia < MAX_DIAS; dia++) {
      const data = paraIso(cursor);
      for (const campanha of campanhas) {
        const doDia = this.gerarMetricasDoDia(
          externalAccountId,
          campanha,
          conjuntos.filter((cj) => cj.campanhaExternalId === campanha.externalId),
          anunciosPorConjunto,
          data,
        );
        metricas.push(...doDia);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return Promise.resolve(metricas);
  }

  // ----- Ações -----

  atualizarStatusCampanha(
    externalAccountId: string,
    campanhaExternalId: string,
    status: Extract<StatusEntrega, 'ativa' | 'pausada'>,
  ): Promise<void> {
    // Promise.resolve().then converte throw síncrono em rejeição (contrato da porta).
    return Promise.resolve().then(() => {
      this.exigirCampanha(externalAccountId, campanhaExternalId);
      const chave = `${externalAccountId}|${campanhaExternalId}`;
      this.overrides.set(chave, { ...this.overrides.get(chave), status });
    });
  }

  atualizarBudgetCampanha(
    externalAccountId: string,
    campanhaExternalId: string,
    budget: number,
  ): Promise<void> {
    return Promise.resolve().then(() => {
      if (!(budget > 0)) {
        throw new Error('Budget deve ser positivo');
      }
      this.exigirCampanha(externalAccountId, campanhaExternalId);
      const chave = `${externalAccountId}|${campanhaExternalId}`;
      this.overrides.set(chave, { ...this.overrides.get(chave), budget });
    });
  }

  // ----- Geração determinística -----

  private gerarCampanhas(acc: string): ProviderCampanha[] {
    // 4 ou 5 campanhas por conta, escolhidas de forma estável pela semente.
    const quantidade = 4 + (fnv1a(`${acc}|n-campanhas`) % 2);
    return MODELOS_CAMPANHA.slice(0, quantidade).map((modelo) => {
      const externalId = `demo-cmp-${modelo.sufixo}`;
      const [min, max] = modelo.budgetFaixa;
      const budget = Math.round(faixa(`${acc}|${externalId}|budget`, min, max));
      const override = this.overrides.get(`${acc}|${externalId}`);
      return {
        externalId,
        nome: modelo.nome,
        objetivo: modelo.objetivo,
        status: override?.status ?? 'ativa',
        budget: override?.budget ?? budget,
        budgetTipo: 'diario' as const,
      };
    });
  }

  private gerarConjuntos(acc: string): ProviderConjunto[] {
    return this.gerarCampanhas(acc).flatMap((campanha) => {
      const modelo = MODELOS_CAMPANHA.find((m) => `demo-cmp-${m.sufixo}` === campanha.externalId);
      if (!modelo) return [];
      const cbo = modelo.objetivo === 'vendas'; // ASC gerencia budget na campanha
      return modelo.conjuntos.map((nome, i) => {
        const externalId = `${campanha.externalId}-set-${i + 1}`;
        return {
          externalId,
          campanhaExternalId: campanha.externalId,
          nome,
          status: 'ativa' as const,
          budget: cbo ? null : Math.round(campanha.budget / modelo.conjuntos.length),
          publico: { descricao: nome, otimizacao: modelo.objetivo },
        };
      });
    });
  }

  private gerarAnunciosDoConjunto(acc: string, conjunto: ProviderConjunto): ProviderAnuncio[] {
    const quantidade = 2 + (fnv1a(`${acc}|${conjunto.externalId}|n-ads`) % 2);
    return Array.from({ length: quantidade }, (_, i) => {
      const externalId = `${conjunto.externalId}-ad-${i + 1}`;
      // ~12% dos anúncios pausados — realismo de conta viva.
      const pausado = rand(`${acc}|${externalId}|pausado`) < 0.12;
      return {
        externalId,
        conjuntoExternalId: conjunto.externalId,
        nome: `${NOMES_ANUNCIO[i % NOMES_ANUNCIO.length] ?? 'Anúncio'} v${i + 1}`,
        status: pausado ? ('pausada' as const) : ('ativa' as const),
        criativoRef: `demo-creative-${fnv1a(`${acc}|${externalId}`).toString(16)}`,
      };
    });
  }

  /**
   * Métricas de UM dia para uma campanha: gera no nível do anúncio e agrega
   * para conjunto e campanha — coerência hierárquica por construção.
   */
  private gerarMetricasDoDia(
    acc: string,
    campanha: ProviderCampanha,
    conjuntos: ProviderConjunto[],
    anunciosPorConjunto: Map<string, ProviderAnuncio[]>,
    data: string,
  ): ProviderMetricaDiaria[] {
    const perfil = PERFIS[campanha.objetivo] ?? PERFIL_PADRAO;
    const ticketMedio = faixa(`${acc}|ticket`, 90, 320);

    const diaSemana = paraDate(data).getUTCDay();
    const diaMes = paraDate(data).getUTCDate();
    const sazonal =
      (FATOR_DIA_SEMANA[diaSemana] ?? 1) *
      (diaMes >= 5 && diaMes <= 10 ? 1.15 : 1) * // quinzena do pagamento
      (1 + 0.0008 * Math.max(0, diasDesdeEpoca(data))); // tendência suave de alta

    const resultado: ProviderMetricaDiaria[] = [];
    let cmpImp = 0;
    let cmpCli = 0;
    let cmpGasto = 0;
    let cmpConv = 0;
    let cmpRec = 0;

    for (const conjunto of conjuntos) {
      const anuncios = anunciosPorConjunto.get(conjunto.externalId) ?? [];
      let cjImp = 0;
      let cjCli = 0;
      let cjGasto = 0;
      let cjConv = 0;
      let cjRec = 0;

      for (const anuncio of anuncios) {
        const chave = `${acc}|${anuncio.externalId}|${data}`;
        // Orçamento diário da campanha rateado por conjunto e anúncio.
        const budgetAnuncio = campanha.budget / Math.max(1, conjuntos.length) / anuncios.length;

        const cpc = perfil.cpcBase * faixa(`${chave}|cpc`, 0.75, 1.25);
        const ctr = perfil.ctrBase * faixa(`${chave}|ctr`, 0.7, 1.3);
        const gasto = budgetAnuncio * sazonal * faixa(`${chave}|pacing`, 0.85, 1.0);

        const cliques = Math.floor(gasto / cpc);
        const impressoes = Math.max(cliques, Math.round(cliques / Math.max(ctr, 0.001)));
        const taxaConv = perfil.taxaConvBase * faixa(`${chave}|cr`, 0.6, 1.4);
        const conversoes = Math.min(cliques, Math.floor(cliques * taxaConv));
        const receita = conversoes * ticketMedio * faixa(`${chave}|aov`, 0.85, 1.25);

        const gastoR = Math.round(gasto * 100) / 100;
        const receitaR = Math.round(receita * 100) / 100;

        resultado.push({
          entidadeTipo: 'anuncio',
          entidadeExternalId: anuncio.externalId,
          data,
          impressoes,
          cliques,
          gasto: gastoR,
          conversoes,
          receita: receitaR,
        });

        cjImp += impressoes;
        cjCli += cliques;
        cjGasto += gastoR;
        cjConv += conversoes;
        cjRec += receitaR;
      }

      resultado.push({
        entidadeTipo: 'conjunto',
        entidadeExternalId: conjunto.externalId,
        data,
        impressoes: cjImp,
        cliques: cjCli,
        gasto: Math.round(cjGasto * 100) / 100,
        conversoes: cjConv,
        receita: Math.round(cjRec * 100) / 100,
      });

      cmpImp += cjImp;
      cmpCli += cjCli;
      cmpGasto += cjGasto;
      cmpConv += cjConv;
      cmpRec += cjRec;
    }

    resultado.push({
      entidadeTipo: 'campanha',
      entidadeExternalId: campanha.externalId,
      data,
      impressoes: cmpImp,
      cliques: cmpCli,
      gasto: Math.round(cmpGasto * 100) / 100,
      conversoes: cmpConv,
      receita: Math.round(cmpRec * 100) / 100,
    });

    return resultado;
  }

  private exigirCampanha(acc: string, campanhaExternalId: string): void {
    const existe = this.gerarCampanhas(acc).some((c) => c.externalId === campanhaExternalId);
    if (!existe) {
      throw new Error(`Campanha "${campanhaExternalId}" não existe na conta demo "${acc}"`);
    }
  }
}
