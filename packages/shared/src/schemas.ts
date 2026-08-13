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
const corHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser hex, ex.: #FF6A2C');

export const agenciaSchema = z.object({
  id: uuidSchema,
  nome: nomeSchema,
  plano: planoSchema,
  status: statusTenantSchema,
  marca_nome: z.string().trim().min(1).max(60).nullable(),
  marca_cor: corHexSchema.nullable(),
  marca_logo_url: z.string().url().nullable(),
  created_at: isoDateTimeSchema,
});
export const criarAgenciaSchema = z.object({
  nome: nomeSchema,
  plano: planoSchema.default('free'),
});

/** Payload de `PATCH /agencias/marca` (Sprint 10 — white-label básico). */
export const atualizarMarcaSchema = z
  .object({
    marca_nome: z.string().trim().min(1).max(60).nullable().optional(),
    marca_cor: corHexSchema.nullable().optional(),
    marca_logo_url: z
      .union([z.literal(''), z.string().url()])
      .nullable()
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });
export type AtualizarMarca = z.infer<typeof atualizarMarcaSchema>;

// ----- usuarios -----
export const usuarioSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  nome: nomeSchema,
  email: emailSchema,
  papel: papelSchema,
  auth_supabase_id: uuidSchema,
  // Operador do SaaS (Sprint 10) — nunca setável via API, só SQL direto.
  super_admin: z.boolean(),
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

// ----- signup (onboarding self-service, Sprint 9 — rota pública) -----
export const signupSchema = z.object({
  nome_agencia: nomeSchema,
  nome: nomeSchema,
  email: emailSchema,
  senha: z.string().min(6, 'Mínimo 6 caracteres').max(72),
  plano: planoSchema.default('starter'),
  // LGPD (Sprint 10): consentimento explícito, obrigatório — vira registro
  // de auditoria (não é só um checkbox decorativo no front).
  aceite_termos: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade' }),
  }),
});
export type Signup = z.infer<typeof signupSchema>;

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
