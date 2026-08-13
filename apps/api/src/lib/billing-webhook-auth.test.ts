import { describe, expect, it } from 'vitest';
import { verificarBillingWebhookAuth } from './billing-webhook-auth';

function basic(credenciais: string): string {
  return `Basic ${Buffer.from(credenciais).toString('base64')}`;
}

describe('verificarBillingWebhookAuth', () => {
  it('sem credenciais configuradas → nao_configurado (fail-closed)', () => {
    expect(verificarBillingWebhookAuth(basic('pagarme:x'), undefined)).toBe('nao_configurado');
    expect(verificarBillingWebhookAuth(basic('pagarme:x'), '')).toBe('nao_configurado');
  });

  it('aceita Basic Auth com as credenciais corretas', () => {
    expect(verificarBillingWebhookAuth(basic('pagarme:s3gr3do'), 'pagarme:s3gr3do')).toBe('ok');
  });

  it('rejeita header ausente, mal formado ou divergente', () => {
    expect(verificarBillingWebhookAuth(undefined, 'pagarme:s3gr3do')).toBe('invalido');
    expect(verificarBillingWebhookAuth('Bearer algo', 'pagarme:s3gr3do')).toBe('invalido');
    expect(verificarBillingWebhookAuth(basic('pagarme:errado'), 'pagarme:s3gr3do')).toBe(
      'invalido',
    );
  });

  it('rejeita base64 mal formado sem lançar', () => {
    expect(verificarBillingWebhookAuth('Basic !!!não-é-base64!!!', 'pagarme:s3gr3do')).toBe(
      'invalido',
    );
  });

  it('rejeita quando o comprimento difere (sem lançar no timingSafeEqual)', () => {
    expect(verificarBillingWebhookAuth(basic('a'), 'um-segredo-bem-mais-longo')).toBe('invalido');
  });
});
