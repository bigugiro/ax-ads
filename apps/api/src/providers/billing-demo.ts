/**
 * DemoBillingProvider — implementação `demo` da porta `BillingProvider`
 * (Sprint 9). Sem `PAGARME_SECRET_KEY` configurada ainda (decisão do
 * usuário, mesma abordagem do `ImagemProvider` no Sprint 8): a assinatura é
 * ativada imediatamente, sem captura de cartão/Pix/boleto real. Um provedor
 * Pagar.me real pluga na mesma porta depois — serviço, rotas e telas não mudam.
 */
import { randomUUID } from 'node:crypto';
import type { BillingAssinaturaCriada, BillingProvider } from '@ax-ads/shared';

export function criarDemoBillingProvider(): BillingProvider {
  return {
    nome: 'demo',
    async criarAssinatura(): Promise<BillingAssinaturaCriada> {
      return Promise.resolve({
        customerId: `demo_cus_${randomUUID()}`,
        subscriptionId: `demo_sub_${randomUUID()}`,
        // Sem gateway real, não há cobrança a confirmar — ativa direto.
        status: 'ativa',
      });
    },
    async cancelarAssinatura(): Promise<void> {
      // Nada a fazer no gateway demo — o serviço chamador é quem marca o
      // status como 'cancelada' em `assinaturas`.
      return Promise.resolve();
    },
  };
}
