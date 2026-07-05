/**
 * Autorização dos jobs de cron (Sprint 2). Sem JWT de usuário: o Vercel Cron
 * envia `Authorization: Bearer <CRON_SECRET>`. Comparação em tempo constante
 * para não vazar o segredo por timing. Fail-closed: sem segredo configurado,
 * nada roda.
 */
import { timingSafeEqual } from 'node:crypto';

export type ResultadoCronAuth = 'ok' | 'nao_configurado' | 'invalido';

function extrairToken(header: string | undefined): string | null {
  if (!header) return null;
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  const limpo = token.trim();
  return limpo.length > 0 ? limpo : null;
}

function igualdadeConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Classifica a autorização de um request de cron contra o segredo configurado. */
export function verificarCronSecret(
  header: string | undefined,
  segredo: string | undefined,
): ResultadoCronAuth {
  if (!segredo) return 'nao_configurado';
  const token = extrairToken(header);
  if (!token) return 'invalido';
  return igualdadeConstante(token, segredo) ? 'ok' : 'invalido';
}
