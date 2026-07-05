import { describe, expect, it } from 'vitest';
import { ACOES, ehPapel, PAPEIS, podeExecutar, temNivelMinimo, type Papel } from './roles';

describe('temNivelMinimo', () => {
  it('owner satisfaz qualquer mínimo', () => {
    for (const min of PAPEIS) {
      expect(temNivelMinimo('owner', min)).toBe(true);
    }
  });

  it('viewer só satisfaz o mínimo viewer', () => {
    expect(temNivelMinimo('viewer', 'viewer')).toBe(true);
    expect(temNivelMinimo('viewer', 'gestor')).toBe(false);
    expect(temNivelMinimo('viewer', 'owner')).toBe(false);
  });

  it('gestor fica entre viewer e owner', () => {
    expect(temNivelMinimo('gestor', 'viewer')).toBe(true);
    expect(temNivelMinimo('gestor', 'gestor')).toBe(true);
    expect(temNivelMinimo('gestor', 'owner')).toBe(false);
  });
});

describe('podeExecutar', () => {
  it('viewer só vê o dashboard', () => {
    expect(podeExecutar('viewer', 'ver_dashboard')).toBe(true);
    expect(podeExecutar('viewer', 'conectar_conta')).toBe(false);
    expect(podeExecutar('viewer', 'operar_campanha')).toBe(false);
    expect(podeExecutar('viewer', 'aplicar_estrategia')).toBe(false);
    expect(podeExecutar('viewer', 'gerenciar_billing')).toBe(false);
  });

  it('gestor opera campanha e estratégia, mas não billing/usuários', () => {
    expect(podeExecutar('gestor', 'conectar_conta')).toBe(true);
    expect(podeExecutar('gestor', 'operar_campanha')).toBe(true);
    expect(podeExecutar('gestor', 'aplicar_estrategia')).toBe(true);
    expect(podeExecutar('gestor', 'aprovar_recomendacao')).toBe(true);
    expect(podeExecutar('gestor', 'gerenciar_usuarios')).toBe(false);
    expect(podeExecutar('gestor', 'gerenciar_billing')).toBe(false);
  });

  it('owner pode tudo', () => {
    for (const acao of ACOES) {
      expect(podeExecutar('owner', acao)).toBe(true);
    }
  });
});

describe('ehPapel', () => {
  it('aceita papéis válidos', () => {
    for (const p of PAPEIS) {
      expect(ehPapel(p)).toBe(true);
    }
  });

  it('rejeita valores inválidos', () => {
    const invalidos: unknown[] = ['admin', '', null, undefined, 1, {}, 'Owner'];
    for (const v of invalidos) {
      expect(ehPapel(v)).toBe(false);
    }
  });

  it('estreita o tipo após o guard', () => {
    const v: unknown = 'gestor';
    if (ehPapel(v)) {
      const p: Papel = v;
      expect(p).toBe('gestor');
    }
  });
});
