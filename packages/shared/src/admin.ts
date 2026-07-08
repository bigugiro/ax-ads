/**
 * Admin mínimo do operador do SaaS (Sprint 10) — cross-tenant, service role.
 * Não é dado de tenant: sem `agencia_id`, sem RLS. As rotas `/admin/*`
 * checam `usuarios.super_admin` no backend antes de qualquer query.
 */
import { z } from 'zod';
import { planoSchema, statusTenantSchema, uuidSchema } from './schemas';
import { statusAssinaturaSchema } from './billing';

export const agenciaAdminSchema = z.object({
  id: uuidSchema,
  nome: z.string().min(1),
  plano: planoSchema,
  status: statusTenantSchema,
  created_at: z.string(),
  assinatura_status: statusAssinaturaSchema.nullable(),
});
export type AgenciaAdmin = z.infer<typeof agenciaAdminSchema>;

/** Payload de `PATCH /admin/agencias/:id` — suspender/reativar uma agência. */
export const atualizarStatusAgenciaSchema = z.object({
  status: statusTenantSchema,
});
export type AtualizarStatusAgencia = z.infer<typeof atualizarStatusAgenciaSchema>;
