/**
 * Porta `ImagemProvider` (Sprint 8, Seção 5 do plano) — mesma decisão de
 * ports & adapters do `AdsProvider` (Sprint 1): uma interface única de
 * geração de imagem, hoje servida por um provider `demo` determinístico
 * (sem chamada externa, sem custo). Um provedor real (OpenAI/Google/etc.)
 * pluga aqui depois, sem retrabalho no serviço, na rota ou na tela.
 */
export interface ImagemGerada {
  /** Data URI (`data:image/svg+xml;base64,...`) ou URL http(s), conforme o provider. */
  url: string;
}

export interface ImagemProvider {
  readonly nome: string;
  gerarImagens(params: { prompt: string; quantidade: number }): Promise<ImagemGerada[]>;
}
