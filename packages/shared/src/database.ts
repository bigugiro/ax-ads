/**
 * Tipos do schema Postgres (espelho manual de `supabase/migrations`).
 * Manter em sincronia ao criar/alterar migrations — é o que tipa o cliente
 * Supabase de ponta a ponta, sem `any` vazando nas queries.
 */
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      papel: Papel;
      plano_tipo: Plano;
      status_tenant: StatusTenant;
      status_cliente: StatusCliente;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
