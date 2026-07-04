import { describe, expect, it } from 'vitest';
import { diffCampos } from './audit';

describe('diffCampos', () => {
  it('retorna apenas os campos alterados', () => {
    const antes = { nome: 'A', status: 'ativo', site: null };
    const depois = { nome: 'A', status: 'pausado', site: null };
    expect(diffCampos(antes, depois)).toEqual({
      antes: { status: 'ativo' },
      depois: { status: 'pausado' },
    });
  });

  it('detecta campo adicionado', () => {
    expect(diffCampos({ a: 1 }, { a: 1, b: 2 })).toEqual({
      antes: { b: undefined },
      depois: { b: 2 },
    });
  });

  it('retorna null/null quando nada muda', () => {
    expect(diffCampos({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({ antes: null, depois: null });
  });

  it('trata null vs valor como mudança', () => {
    expect(diffCampos({ site: null }, { site: 'https://x.com' })).toEqual({
      antes: { site: null },
      depois: { site: 'https://x.com' },
    });
  });
});
