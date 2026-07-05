/**
 * Tipos do schema Postgres (espelho manual de `supabase/migrations`).
 * Manter em sincronia ao criar/alterar migrations — é o que tipa o cliente
 * Supabase de ponta a ponta, sem `any` vazando nas queries.
 */
import type { BudgetTipo, EntidadeMetrica, Plataforma, StatusConta, StatusEntrega } from './ads';
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
    };
    CompositeTypes: { [_ in never]: never };
  };
}
