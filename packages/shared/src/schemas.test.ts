import { describe, expect, it } from 'vitest';
import {
  atualizarClienteSchema,
  atualizarUsuarioSchema,
  criarAgenciaSchema,
  criarClienteSchema,
  criarUsuarioSchema,
} from './schemas';

describe('criarAgenciaSchema', () => {
  it('aplica plano free por padrão', () => {
    const r = criarAgenciaSchema.parse({ nome: 'Agência X' });
    expect(r).toEqual({ nome: 'Agência X', plano: 'free' });
  });

  it('rejeita nome vazio', () => {
    expect(criarAgenciaSchema.safeParse({ nome: '   ' }).success).toBe(false);
  });
});

describe('criarUsuarioSchema', () => {
  it('normaliza email (trim + lowercase) e default papel gestor', () => {
    const r = criarUsuarioSchema.parse({ nome: 'Ana', email: '  ANA@X.COM ' });
    expect(r.email).toBe('ana@x.com');
    expect(r.papel).toBe('gestor');
  });

  it('rejeita papel inválido', () => {
    const r = criarUsuarioSchema.safeParse({ nome: 'Ana', email: 'a@x.com', papel: 'admin' });
    expect(r.success).toBe(false);
  });
});

describe('atualizarUsuarioSchema', () => {
  it('exige ao menos um campo', () => {
    expect(atualizarUsuarioSchema.safeParse({}).success).toBe(false);
    expect(atualizarUsuarioSchema.safeParse({ papel: 'owner' }).success).toBe(true);
  });
});

describe('criarClienteSchema', () => {
  it('aceita site vazio e default status ativo', () => {
    const r = criarClienteSchema.parse({ nome: 'Loja Y', site: '' });
    expect(r.status).toBe('ativo');
  });

  it('rejeita site inválido não-vazio', () => {
    expect(criarClienteSchema.safeParse({ nome: 'Loja Y', site: 'nao-e-url' }).success).toBe(false);
  });

  it('aceita site válido', () => {
    expect(criarClienteSchema.safeParse({ nome: 'Loja Y', site: 'https://loja.com' }).success).toBe(
      true,
    );
  });
});

describe('atualizarClienteSchema', () => {
  it('exige ao menos um campo', () => {
    expect(atualizarClienteSchema.safeParse({}).success).toBe(false);
    expect(atualizarClienteSchema.safeParse({ status: 'pausado' }).success).toBe(true);
  });
});
