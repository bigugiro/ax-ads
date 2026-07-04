/**
 * Schemas Zod das entidades de tenancy (Sprint 0) e tipos inferidos.
 * Regra do CLAUDE.md: validação de input com Zod em toda rota.
 *
 * Convenção: `*Schema` valida a linha completa (como vem do banco);
 * `criar*` / `atualizar*` validam o payload das rotas (sem colunas server-side).
 */
import { z } from 'zod';
import { PAPEIS } from './roles';

// ----- Primitivos reutilizáveis -----
export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const papelSchema = z.enum(PAPEIS);
export const planoSchema = z.enum(['free', 'starter', 'pro', 'agency']);
export const statusTenantSchema = z.enum(['ativo', 'inativo', 'suspenso']);
export const statusClienteSchema = z.enum(['ativo', 'pausado', 'arquivado']);

const nomeSchema = z.string().trim().min(1, 'Nome é obrigatório').max(120);
const emailSchema = z.string().trim().toLowerCase().email();
// URL opcional que aceita string vazia (front manda "" quando não preenchido).
const siteSchema = z.union([z.literal(''), z.string().url()]).optional();

// ----- agencias -----
export const agenciaSchema = z.object({
  id: uuidSchema,
  nome: nomeSchema,
  plano: planoSchema,
  status: statusTenantSchema,
  created_at: isoDateTimeSchema,
});
export const criarAgenciaSchema = z.object({
  nome: nomeSchema,
  plano: planoSchema.default('free'),
});

// ----- usuarios -----
export const usuarioSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  nome: nomeSchema,
  email: emailSchema,
  papel: papelSchema,
  auth_supabase_id: uuidSchema,
  created_at: isoDateTimeSchema,
});
export const criarUsuarioSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  papel: papelSchema.default('gestor'),
});
export const atualizarUsuarioSchema = z
  .object({
    nome: nomeSchema.optional(),
    papel: papelSchema.optional(),
  })
  .refine((v) => v.nome !== undefined || v.papel !== undefined, {
    message: 'Informe ao menos um campo para atualizar',
  });

// ----- clientes (o e-commerce atendido) -----
export const clienteSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  nome: nomeSchema,
  nicho: z.string().trim().max(80).nullable(),
  site: z.string().url().nullable(),
  status: statusClienteSchema,
  created_at: isoDateTimeSchema,
});
export const criarClienteSchema = z.object({
  nome: nomeSchema,
  nicho: z.string().trim().max(80).optional(),
  site: siteSchema,
  status: statusClienteSchema.default('ativo'),
});
export const atualizarClienteSchema = z
  .object({
    nome: nomeSchema.optional(),
    nicho: z.string().trim().max(80).nullable().optional(),
    site: siteSchema,
    status: statusClienteSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

// ----- Tipos inferidos -----
export type Agencia = z.infer<typeof agenciaSchema>;
export type CriarAgencia = z.infer<typeof criarAgenciaSchema>;
export type Usuario = z.infer<typeof usuarioSchema>;
export type CriarUsuario = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuario = z.infer<typeof atualizarUsuarioSchema>;
export type Cliente = z.infer<typeof clienteSchema>;
export type CriarCliente = z.infer<typeof criarClienteSchema>;
export type AtualizarCliente = z.infer<typeof atualizarClienteSchema>;

export type Plano = z.infer<typeof planoSchema>;
export type StatusTenant = z.infer<typeof statusTenantSchema>;
export type StatusCliente = z.infer<typeof statusClienteSchema>;
