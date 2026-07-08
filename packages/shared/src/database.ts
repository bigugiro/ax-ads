/**
 * Tipos do schema Postgres (espelho manual de `supabase/migrations`).
 * Manter em sincronia ao criar/alterar migrations — é o que tipa o cliente
 * Supabase de ponta a ponta, sem `any` vazando nas queries.
 */
import type { BudgetTipo, EntidadeMetrica, Plataforma, StatusConta, StatusEntrega } from './ads';
import type { GatilhoAutomacao, StatusLead } from './crm';
import type {
  CanalEstrategia,
  ImpactoEstrategia,
  NivelEstrategia,
  StatusEstrategiaAplicada,
} from './estrategias';
import type { ModeloIA, OrigemCreativo, StatusCreativo, TipoCreativo } from './ia';
import type { Papel } from './roles';
import type { Plano, StatusCliente, StatusTenant } from './schemas';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      agencias: {
        Row: {
          id: string;
          nome: string;
          plano: Plano;
          status: StatusTenant;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          nome: string;
          plano?: Plano | undefined;
          status?: StatusTenant | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          nome?: string | undefined;
          plano?: Plano | undefined;
          status?: StatusTenant | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          agencia_id: string;
          nome: string;
          email: string;
          papel: Papel;
          auth_supabase_id: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          nome: string;
          email: string;
          papel?: Papel | undefined;
          auth_supabase_id: string;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          nome?: string | undefined;
          email?: string | undefined;
          papel?: Papel | undefined;
          auth_supabase_id?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          agencia_id: string;
          nome: string;
          nicho: string | null;
          site: string | null;
          status: StatusCliente;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          nome: string;
          nicho?: string | null | undefined;
          site?: string | null | undefined;
          status?: StatusCliente | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          nome?: string | undefined;
          nicho?: string | null | undefined;
          site?: string | null | undefined;
          status?: StatusCliente | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          agencia_id: string;
          usuario_id: string | null;
          acao: string;
          entidade: string;
          antes: Json | null;
          depois: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          usuario_id?: string | null | undefined;
          acao: string;
          entidade: string;
          antes?: Json | null | undefined;
          depois?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          usuario_id?: string | null | undefined;
          acao?: string | undefined;
          entidade?: string | undefined;
          antes?: Json | null | undefined;
          depois?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      contas_anuncio: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          plataforma: Plataforma;
          external_account_id: string;
          nome: string;
          moeda: string;
          token_ref: string | null;
          escopo: string | null;
          status: StatusConta;
          ultimo_sync_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          plataforma: Plataforma;
          external_account_id: string;
          nome: string;
          moeda?: string | undefined;
          token_ref?: string | null | undefined;
          escopo?: string | null | undefined;
          status?: StatusConta | undefined;
          ultimo_sync_at?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          plataforma?: Plataforma | undefined;
          external_account_id?: string | undefined;
          nome?: string | undefined;
          moeda?: string | undefined;
          token_ref?: string | null | undefined;
          escopo?: string | null | undefined;
          status?: StatusConta | undefined;
          ultimo_sync_at?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      campanhas: {
        Row: {
          id: string;
          agencia_id: string;
          conta_anuncio_id: string;
          external_id: string;
          nome: string;
          objetivo: string;
          status: StatusEntrega;
          budget: number;
          budget_tipo: BudgetTipo;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          conta_anuncio_id: string;
          external_id: string;
          nome: string;
          objetivo: string;
          status?: StatusEntrega | undefined;
          budget: number;
          budget_tipo?: BudgetTipo | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          conta_anuncio_id?: string | undefined;
          external_id?: string | undefined;
          nome?: string | undefined;
          objetivo?: string | undefined;
          status?: StatusEntrega | undefined;
          budget?: number | undefined;
          budget_tipo?: BudgetTipo | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      conjuntos: {
        Row: {
          id: string;
          agencia_id: string;
          campanha_id: string;
          external_id: string;
          nome: string;
          status: StatusEntrega;
          budget: number | null;
          publico: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          campanha_id: string;
          external_id: string;
          nome: string;
          status?: StatusEntrega | undefined;
          budget?: number | null | undefined;
          publico?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          campanha_id?: string | undefined;
          external_id?: string | undefined;
          nome?: string | undefined;
          status?: StatusEntrega | undefined;
          budget?: number | null | undefined;
          publico?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      anuncios: {
        Row: {
          id: string;
          agencia_id: string;
          conjunto_id: string;
          external_id: string;
          nome: string;
          status: StatusEntrega;
          criativo_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          conjunto_id: string;
          external_id: string;
          nome: string;
          status?: StatusEntrega | undefined;
          criativo_ref?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          conjunto_id?: string | undefined;
          external_id?: string | undefined;
          nome?: string | undefined;
          status?: StatusEntrega | undefined;
          criativo_ref?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      metricas_diarias: {
        Row: {
          id: string;
          agencia_id: string;
          entidade_tipo: EntidadeMetrica;
          entidade_id: string;
          data: string;
          impressoes: number;
          cliques: number;
          gasto: number;
          conversoes: number;
          receita: number;
          // Colunas geradas no banco (nunca entram em Insert/Update).
          ctr: number;
          cpa: number | null;
          roas: number | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          entidade_tipo: EntidadeMetrica;
          entidade_id: string;
          data: string;
          impressoes?: number | undefined;
          cliques?: number | undefined;
          gasto?: number | undefined;
          conversoes?: number | undefined;
          receita?: number | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          entidade_tipo?: EntidadeMetrica | undefined;
          entidade_id?: string | undefined;
          data?: string | undefined;
          impressoes?: number | undefined;
          cliques?: number | undefined;
          gasto?: number | undefined;
          conversoes?: number | undefined;
          receita?: number | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      estrategias: {
        Row: {
          id: string;
          slug: string;
          titulo: string;
          categoria: string;
          canal: CanalEstrategia;
          objetivo: string;
          quando_usar: string;
          impacto: ImpactoEstrategia[];
          pre_requisitos: Json;
          passos: Json;
          guardrails: Json;
          kpi_sucesso: string;
          nivel: NivelEstrategia;
          versao: number;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          slug: string;
          titulo: string;
          categoria: string;
          canal: CanalEstrategia;
          objetivo: string;
          quando_usar: string;
          impacto?: ImpactoEstrategia[] | undefined;
          pre_requisitos?: Json | undefined;
          passos?: Json | undefined;
          guardrails?: Json | undefined;
          kpi_sucesso: string;
          nivel?: NivelEstrategia | undefined;
          versao?: number | undefined;
          ativo?: boolean | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          slug?: string | undefined;
          titulo?: string | undefined;
          categoria?: string | undefined;
          canal?: CanalEstrategia | undefined;
          objetivo?: string | undefined;
          quando_usar?: string | undefined;
          impacto?: ImpactoEstrategia[] | undefined;
          pre_requisitos?: Json | undefined;
          passos?: Json | undefined;
          guardrails?: Json | undefined;
          kpi_sucesso?: string | undefined;
          nivel?: NivelEstrategia | undefined;
          versao?: number | undefined;
          ativo?: boolean | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      estrategia_versoes: {
        Row: {
          id: string;
          estrategia_id: string;
          versao: number;
          mudanca: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          estrategia_id: string;
          versao: number;
          mudanca: string;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          estrategia_id?: string | undefined;
          versao?: number | undefined;
          mudanca?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      estrategias_aplicadas: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          estrategia_id: string;
          estrategia_versao: number;
          status: StatusEstrategiaAplicada;
          aplicada_em: string | null;
          config: Json;
          resultado: Json | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          estrategia_id: string;
          estrategia_versao: number;
          status?: StatusEstrategiaAplicada | undefined;
          aplicada_em?: string | null | undefined;
          config?: Json | undefined;
          resultado?: Json | null | undefined;
          notas?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          estrategia_id?: string | undefined;
          estrategia_versao?: number | undefined;
          status?: StatusEstrategiaAplicada | undefined;
          aplicada_em?: string | null | undefined;
          config?: Json | undefined;
          resultado?: Json | null | undefined;
          notas?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      estrategia_checklist_itens: {
        Row: {
          id: string;
          agencia_id: string;
          estrategia_aplicada_id: string;
          descricao: string;
          feito: boolean;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          estrategia_aplicada_id: string;
          descricao: string;
          feito?: boolean | undefined;
          ordem?: number | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          estrategia_aplicada_id?: string | undefined;
          descricao?: string | undefined;
          feito?: boolean | undefined;
          ordem?: number | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      pipelines: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          nome: string;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          nome?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      estagios: {
        Row: {
          id: string;
          agencia_id: string;
          pipeline_id: string;
          nome: string;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          pipeline_id: string;
          nome: string;
          ordem?: number | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          pipeline_id?: string | undefined;
          nome?: string | undefined;
          ordem?: number | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          estagio_id: string;
          nome: string;
          contato: string;
          origem: string;
          valor: number | null;
          status: StatusLead;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          estagio_id: string;
          nome: string;
          contato: string;
          origem?: string | undefined;
          valor?: number | null | undefined;
          status?: StatusLead | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          estagio_id?: string | undefined;
          nome?: string | undefined;
          contato?: string | undefined;
          origem?: string | undefined;
          valor?: number | null | undefined;
          status?: StatusLead | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      eventos_lead: {
        Row: {
          id: string;
          agencia_id: string;
          lead_id: string;
          tipo: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          lead_id: string;
          tipo: string;
          payload?: Json | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          lead_id?: string | undefined;
          tipo?: string | undefined;
          payload?: Json | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      automacoes: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          nome: string;
          gatilho: GatilhoAutomacao;
          condicoes: Json;
          acoes: Json;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          nome: string;
          gatilho: GatilhoAutomacao;
          condicoes?: Json | undefined;
          acoes?: Json | undefined;
          ativo?: boolean | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          nome?: string | undefined;
          gatilho?: GatilhoAutomacao | undefined;
          condicoes?: Json | undefined;
          acoes?: Json | undefined;
          ativo?: boolean | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      execucoes_automacao: {
        Row: {
          id: string;
          agencia_id: string;
          automacao_id: string;
          lead_id: string;
          resultado: Json;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          automacao_id: string;
          lead_id: string;
          resultado?: Json | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          automacao_id?: string | undefined;
          lead_id?: string | undefined;
          resultado?: Json | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      criativos: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          tipo: TipoCreativo;
          conteudo: string;
          origem: OrigemCreativo;
          status: StatusCreativo;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          tipo: TipoCreativo;
          conteudo: string;
          origem?: OrigemCreativo | undefined;
          status?: StatusCreativo | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          tipo?: TipoCreativo | undefined;
          conteudo?: string | undefined;
          origem?: OrigemCreativo | undefined;
          status?: StatusCreativo | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      variacoes_criativo: {
        Row: {
          id: string;
          agencia_id: string;
          criativo_id: string;
          conteudo: string;
          metrica_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          criativo_id: string;
          conteudo: string;
          metrica_ref?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          criativo_id?: string | undefined;
          conteudo?: string | undefined;
          metrica_ref?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      geracoes_ia: {
        Row: {
          id: string;
          agencia_id: string;
          cliente_id: string;
          modelo: ModeloIA;
          prompt: string;
          resultado: Json;
          tokens_in: number;
          tokens_out: number;
          custo: number;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          agencia_id: string;
          cliente_id: string;
          modelo: ModeloIA;
          prompt: string;
          resultado: Json;
          tokens_in: number;
          tokens_out: number;
          custo: number;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          agencia_id?: string | undefined;
          cliente_id?: string | undefined;
          modelo?: ModeloIA | undefined;
          prompt?: string | undefined;
          resultado?: Json | undefined;
          tokens_in?: number | undefined;
          tokens_out?: number | undefined;
          custo?: number | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      papel: Papel;
      plano_tipo: Plano;
      status_tenant: StatusTenant;
      status_cliente: StatusCliente;
      plataforma_ads: Plataforma;
      status_conta: StatusConta;
      status_entrega: StatusEntrega;
      budget_tipo: BudgetTipo;
      entidade_metrica: EntidadeMetrica;
      canal_estrategia: CanalEstrategia;
      nivel_estrategia: NivelEstrategia;
      impacto_estrategia: ImpactoEstrategia;
      status_estrategia_aplicada: StatusEstrategiaAplicada;
      status_lead: StatusLead;
      gatilho_automacao: GatilhoAutomacao;
      tipo_criativo: TipoCreativo;
      origem_criativo: OrigemCreativo;
      status_criativo: StatusCreativo;
      modelo_ia: ModeloIA;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
