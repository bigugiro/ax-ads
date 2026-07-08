/**
 * Porta `BillingProvider` (Sprint 9) — mesma decisão de ports & adapters do
 * `AdsProvider` (Sprint 1) e do `ImagemProvider` (Sprint 8): uma interface
 * única de assinatura, hoje servida por um provider `demo` (sem chave
 * Pagar.me configurada ainda). O Pagar.me real pluga aqui depois, sem
 * retrabalho no serviço, na rota ou na tela.
 */
import type { Plano } from './schemas';
import type { StatusAssinatura } from './billing';

export interface BillingCliente {
  nome: string;
  email: string;
}

export interface BillingAssinaturaCriada {
  customerId: string;
  subscriptionId: string;
  status: StatusAssinatura;
}

export interface BillingProvider {
  readonly nome: string;
  criarAssinatura(params: { plano: Plano; cliente: BillingCliente }): Promise<BillingAssinaturaCriada>;
  cancelarAssinatura(subscriptionId: string): Promise<void>;
}
