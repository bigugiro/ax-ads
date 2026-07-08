/**
 * Billing (Sprint 9, Seção 4/5 do plano) — assinaturas via Pagar.me (API v5).
 * `PRECOS_PLANO` é o núcleo PURO (sem IO) — testável isoladamente. Preços em
 * centavos (evita ponto flutuante em dinheiro), tabela cacheada em 2026-07-08
 * (placeholder: nenhuma chave Pagar.me configurada ainda — ver Sprint 8, mesma
 * decisão de produto para `ImagemProvider`).
 */
import { z } from 'zod';
import { planoSchema, uuidSchema, type Plano } from './schemas';

export const statusAssinaturaSchema = z.enum(['trialing', 'ativa', 'inadimplente', 'cancelada']);
export type StatusAssinatura = z.infer<typeof statusAssinaturaSchema>;

export const assinaturaSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  plano: planoSchema,
  status: statusAssinaturaSchema,
  pagarme_customer_id: z.string().nullable(),
  pagarme_subscription_id: z.string().nullable(),
  created_at: z.string(),
  atualizado_em: z.string(),
});
export type Assinatura = z.infer<typeof assinaturaSchema>;

/** Payload de `POST /billing/checkout` — assinar ou trocar de plano. */
export const criarCheckoutSchema = z.object({
  plano: planoSchema.exclude(['free']),
});
export type CriarCheckout = z.infer<typeof criarCheckoutSchema>;

/**
 * Payload de `POST /billing/webhook` — formato PROVISÓRIO (contrato normalizado
 * nosso, não o payload real do Pagar.me). Quando um provedor real for plugado,
 * troca-se só o parser aqui — a autorização (Basic Auth) e o efeito colateral
 * (atualizar `assinaturas.status`) não mudam. Ver `docs.pagar.me` na integração real.
 */
export const webhookBillingSchema = z.object({
  pagarme_subscription_id: z.string().min(1),
  status: statusAssinaturaSchema,
});
export type WebhookBilling = z.infer<typeof webhookBillingSchema>;

/** Preço mensal por plano, em centavos (BRL). `free` não cobra. */
export const PRECOS_PLANO: Record<Plano, number> = {
  free: 0,
  starter: 9_700,
  pro: 24_700,
  agency: 49_700,
};

/** Formata centavos em "R$ 97,00" (pt-BR). */
export function formatarPrecoPlano(plano: Plano): string {
  const centavos = PRECOS_PLANO[plano];
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
