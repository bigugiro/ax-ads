/**
 * DemoImagemProvider — implementação `demo` da porta `ImagemProvider` (Sprint 8).
 *
 * Gera um placeholder visual SEM chamar API nenhuma: um SVG determinístico
 * (cor de fundo derivada do hash do prompt + índice da variação, texto do
 * produto centralizado) codificado como data URI. Mesma decisão do
 * `DemoProvider` de anúncios (Sprint 1): a porta é o contrato estável; um
 * provedor real (OpenAI/Google/etc.) pluga aqui depois sem tocar em
 * serviço, rota ou tela. `gerarSvgPlaceholder` é PURO — testável sem IO.
 */
import type { ImagemGerada, ImagemProvider } from '@ax-ads/shared';

/** Hash FNV-1a de 32 bits — mesma técnica do DemoProvider de anúncios. */
function fnv1a(chave: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Paleta na identidade Dispara (laranja/roxo) — cor escolhida pelo hash. */
const PALETA = ['#FF6A2C', '#6B3FE4', '#1F9D6B', '#D64545', '#2563EB'] as const;

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Monta um SVG 1024×1024 determinístico a partir do prompt + índice da variação. */
export function gerarSvgPlaceholder(prompt: string, indice: number): string {
  const chave = `${prompt}|${indice}`;
  const cor = PALETA[fnv1a(chave) % PALETA.length]!;
  const rotulo = escaparXml(prompt.slice(0, 40));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<rect width="1024" height="1024" fill="${cor}"/>` +
    `<text x="512" y="512" fill="#ffffff" font-family="sans-serif" font-size="42" ` +
    `font-weight="700" text-anchor="middle" dominant-baseline="middle">${rotulo}</text>` +
    `<text x="512" y="580" fill="#ffffffb3" font-family="sans-serif" font-size="22" ` +
    `text-anchor="middle">variação ${indice + 1} · placeholder demo</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export function criarDemoImagemProvider(): ImagemProvider {
  return {
    nome: 'demo',
    gerarImagens({ prompt, quantidade }): Promise<ImagemGerada[]> {
      return Promise.resolve(
        Array.from({ length: quantidade }, (_, i) => ({ url: gerarSvgPlaceholder(prompt, i) })),
      );
    },
  };
}
