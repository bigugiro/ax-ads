/** Registry de providers: resolve a plataforma para a implementação da porta. */
import type { AdsProvider, Plataforma } from '@ax-ads/shared';
import { HttpError } from '../lib/http';
import { DemoProvider } from './demo';

// Singleton por processo: mantém os overrides de ação do demo entre requests.
const demoProvider = new DemoProvider();

/** Provider da plataforma, ou 501 para integrações ainda não plugadas. */
export function getProvider(plataforma: Plataforma): AdsProvider {
  switch (plataforma) {
    case 'demo':
      return demoProvider;
    case 'meta':
    case 'google':
      throw new HttpError(
        501,
        `Integração "${plataforma}" ainda não disponível — chega nos Sprints 11–12. Use "demo".`,
      );
  }
}
