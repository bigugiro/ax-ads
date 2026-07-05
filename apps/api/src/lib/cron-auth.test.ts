import { describe, expect, it } from 'vitest';
import { verificarCronSecret } from './cron-auth';

describe('verificarCronSecret', () => {
  it('sem segredo configurado → nao_configurado (fail-closed)', () => {
    expect(verificarCronSecret('Bearer x', undefined)).toBe('nao_configurado');
    expect(verificarCronSecret('Bearer x', '')).toBe('nao_configurado');
  });

  it('aceita o segredo com e sem prefixo Bearer', () => {
    expect(verificarCronSecret('Bearer s3gr3do', 's3gr3do')).toBe('ok');
    expect(verificarCronSecret('s3gr3do', 's3gr3do')).toBe('ok');
  });

  it('rejeita header ausente, vazio ou divergente', () => {
    expect(verificarCronSecret(undefined, 's3gr3do')).toBe('invalido');
    expect(verificarCronSecret('Bearer ', 's3gr3do')).toBe('invalido');
    expect(verificarCronSecret('Bearer errado', 's3gr3do')).toBe('invalido');
  });

  it('rejeita quando o comprimento difere (sem lançar no timingSafeEqual)', () => {
    expect(verificarCronSecret('Bearer curto', 'um-segredo-bem-mais-longo')).toBe('invalido');
  });
});
