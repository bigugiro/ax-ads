/**
 * Contrato do `ImagemProvider` provado sobre o `demo` (Sprint 8) — determinístico
 * e sem IO, mesma decisão do `DemoProvider` de anúncios (Sprint 1).
 */
import { describe, expect, it } from 'vitest';
import { criarDemoImagemProvider, gerarSvgPlaceholder } from './imagem-demo';

describe('gerarSvgPlaceholder (puro)', () => {
  it('é determinístico: mesmo prompt+índice → mesmo data URI', () => {
    expect(gerarSvgPlaceholder('Tênis de corrida', 0)).toBe(gerarSvgPlaceholder('Tênis de corrida', 0));
  });

  it('índices diferentes geram data URIs diferentes (variação visual)', () => {
    const a = gerarSvgPlaceholder('Tênis de corrida', 0);
    const b = gerarSvgPlaceholder('Tênis de corrida', 1);
    expect(a).not.toBe(b);
  });

  it('prompts diferentes geram data URIs diferentes', () => {
    const a = gerarSvgPlaceholder('Tênis de corrida', 0);
    const b = gerarSvgPlaceholder('Mochila urbana', 0);
    expect(a).not.toBe(b);
  });

  it('é um data URI de SVG válido em base64', () => {
    const uri = gerarSvgPlaceholder('Produto', 0);
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    const base64 = uri.split(',')[1]!;
    const svg = Buffer.from(base64, 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Produto');
  });

  it('escapa caracteres XML no rótulo (sem quebrar o SVG)', () => {
    const uri = gerarSvgPlaceholder('Tênis "Air" <novo>', 0);
    const svg = Buffer.from(uri.split(',')[1]!, 'base64').toString('utf8');
    expect(svg).not.toContain('<novo>');
    expect(svg).toContain('&lt;novo&gt;');
  });
});

describe('criarDemoImagemProvider', () => {
  it('gera a quantidade pedida de variações, cada uma com URL própria', async () => {
    const provider = criarDemoImagemProvider();
    const imagens = await provider.gerarImagens({ prompt: 'Óculos de sol', quantidade: 3 });
    expect(imagens).toHaveLength(3);
    const urls = new Set(imagens.map((i) => i.url));
    expect(urls.size).toBe(3);
  });

  it('nome do provider é "demo"', () => {
    expect(criarDemoImagemProvider().nome).toBe('demo');
  });
});
