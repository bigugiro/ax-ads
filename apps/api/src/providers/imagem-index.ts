/**
 * Registry do `ImagemProvider` (Sprint 8) — hoje só o `demo` (sem chave de
 * API nenhuma configurada). Quando um provedor real for decidido, este é o
 * único ponto que muda: o serviço e a rota já falam com a porta.
 */
import type { ImagemProvider } from '@ax-ads/shared';
import { criarDemoImagemProvider } from './imagem-demo';

const demoImagemProvider = criarDemoImagemProvider();

export function getImagemProvider(): ImagemProvider {
  return demoImagemProvider;
}
