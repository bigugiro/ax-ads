/** Cliente Anthropic (Sprint 6 — Studio criativo IA). Nunca logar a chave. */
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './http';
import { getEnv } from './env';

let client: Anthropic | undefined;

/** Cliente Anthropic, ou 503 se `ANTHROPIC_API_KEY` não estiver configurada (fail-closed). */
export function getAnthropicClient(): Anthropic {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'Studio criativo indisponível: ANTHROPIC_API_KEY não configurada');
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Modelos usados pelo Studio criativo (Seção 2 do plano: Haiku classifica, Sonnet gera/analisa). */
export const MODELOS_ANTHROPIC = {
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5',
} as const;
