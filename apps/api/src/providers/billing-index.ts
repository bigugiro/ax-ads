/**
 * Registry do `BillingProvider` (Sprint 9) — hoje só o `demo` (sem chave
 * Pagar.me configurada). Quando a integração real entrar, este é o único
 * ponto que muda.
 */
import type { BillingProvider } from '@ax-ads/shared';
import { criarDemoBillingProvider } from './billing-demo';

const demoBillingProvider = criarDemoBillingProvider();

export function getBillingProvider(): BillingProvider {
  return demoBillingProvider;
}
