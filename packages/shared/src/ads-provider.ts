/**
 * Camada `AdsProvider` (ports & adapters) — decisão de 2026-07-04.
 *
 * Interface única de leitura (contas, campanhas, conjuntos, anúncios,
 * métricas) e ação (status, budget) sobre uma plataforma de mídia paga.
 * Do Sprint 1 ao 10 o produto roda no provider `demo` (dados sintéticos);
 * nos Sprints 11–12 `MetaProvider`/`GoogleProvider` plugam AQUI, sem
 * retrabalho em telas, automações ou PDCA.
 *
 * Convenção dos DTOs: campos em camelCase e ids EXTERNOS (da plataforma).
 * O espelho no banco (snake_case, ids locais) é responsabilidade do sync.
 */
import type { BudgetTipo, EntidadeMetrica, Plataforma, StatusEntrega } from './ads';
import type { Json } from './database';

export interface ProviderConta {
  externalAccountId: string;
  nome: string;
  moeda: string;
}

export interface ProviderCampanha {
  externalId: string;
  nome: string;
  objetivo: string;
  status: StatusEntrega;
  budget: number;
  budgetTipo: BudgetTipo;
}

export interface ProviderConjunto {
  externalId: string;
  campanhaExternalId: string;
  nome: string;
  status: StatusEntrega;
  /** `null` quando o orçamento é gerido no nível da campanha (CBO). */
  budget: number | null;
  publico: { [key: string]: Json | undefined } | null;
}

export interface ProviderAnuncio {
  externalId: string;
  conjuntoExternalId: string;
  nome: string;
  status: StatusEntrega;
  criativoRef: string | null;
}

export interface ProviderMetricaDiaria {
  entidadeTipo: EntidadeMetrica;
  entidadeExternalId: string;
  /** Data-calendário YYYY-MM-DD. */
  data: string;
  impressoes: number;
  cliques: number;
  gasto: number;
  conversoes: number;
  receita: number;
}

export interface PeriodoMetricas {
  /** Inclusivo, YYYY-MM-DD. */
  inicio: string;
  /** Inclusivo, YYYY-MM-DD. */
  fim: string;
}

/** Porta única que toda plataforma de anúncios implementa. */
export interface AdsProvider {
  readonly plataforma: Plataforma;

  // ----- Leitura -----
  /** Contas disponíveis para conectar (ex.: contas do Business Manager). */
  listarContas(): Promise<ProviderConta[]>;
  /** Conta pelo id externo, ou `null` se não existir na plataforma. */
  buscarConta(externalAccountId: string): Promise<ProviderConta | null>;
  listarCampanhas(externalAccountId: string): Promise<ProviderCampanha[]>;
  listarConjuntos(externalAccountId: string): Promise<ProviderConjunto[]>;
  listarAnuncios(externalAccountId: string): Promise<ProviderAnuncio[]>;
  listarMetricasDiarias(
    externalAccountId: string,
    periodo: PeriodoMetricas,
  ): Promise<ProviderMetricaDiaria[]>;

  // ----- Ações (Sprint 3 consome; toda chamada é auditada na API) -----
  atualizarStatusCampanha(
    externalAccountId: string,
    campanhaExternalId: string,
    status: Extract<StatusEntrega, 'ativa' | 'pausada'>,
  ): Promise<void>;
  atualizarBudgetCampanha(
    externalAccountId: string,
    campanhaExternalId: string,
    budget: number,
  ): Promise<void>;
}
