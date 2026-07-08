/**
 * Autorização do webhook de billing (Sprint 9). O Pagar.me chama com Basic
 * Auth (`Authorization: Basic base64(usuario:senha)`), configurado no painel
 * deles como `PAGARME_WEBHOOK_AUTH` (formato `usuario:senha`). Mesmo padrão
 * de `cron-auth.ts`: comparação em tempo constante, fail-closed sem segredo.
 */
import { timingSafeEqual } from 'node:crypto';

export type ResultadoBillingWebhookAuth = 'ok' | 'nao_configurado' | 'invalido';

function extrairCredenciais(header: string | undefined): string | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decodificado = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    return decodificado.length > 0 ? decodificado : null;
  } catch {
    return null;
  }
}

function igualdadeConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Classifica a autorização do webhook contra `usuario:senha` configurado. */
export function verificarBillingWebhookAuth(
  header: string | undefined,
  credenciais: string | undefined,
): ResultadoBillingWebhookAuth {
  if (!credenciais) return 'nao_configurado';
  const recebido = extrairCredenciais(header);
  if (!recebido) return 'invalido';
  return igualdadeConstante(recebido, credenciais) ? 'ok' : 'invalido';
}
