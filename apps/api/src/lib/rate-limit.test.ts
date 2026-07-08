import { beforeEach, describe, expect, it } from 'vitest';
import { _resetRateLimitParaTestes, permitirChamada } from './rate-limit';

describe('permitirChamada (puro)', () => {
  beforeEach(() => _resetRateLimitParaTestes());

  it('permite até o limite dentro da janela', () => {
    const opts = { limite: 3, janelaMs: 1000 };
    expect(permitirChamada('k', opts, 0)).toBe(true);
    expect(permitirChamada('k', opts, 10)).toBe(true);
    expect(permitirChamada('k', opts, 20)).toBe(true);
    expect(permitirChamada('k', opts, 30)).toBe(false); // 4ª chamada na mesma janela
  });

  it('reabre a janela depois de expirar', () => {
    const opts = { limite: 1, janelaMs: 1000 };
    expect(permitirChamada('k', opts, 0)).toBe(true);
    expect(permitirChamada('k', opts, 500)).toBe(false);
    expect(permitirChamada('k', opts, 1000)).toBe(true); // nova janela
  });

  it('chaves diferentes têm buckets independentes', () => {
    const opts = { limite: 1, janelaMs: 1000 };
    expect(permitirChamada('a', opts, 0)).toBe(true);
    expect(permitirChamada('b', opts, 0)).toBe(true);
    expect(permitirChamada('a', opts, 0)).toBe(false);
    expect(permitirChamada('b', opts, 0)).toBe(false);
  });
});
