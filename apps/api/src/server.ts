/** Servidor local (dev). Em produção usamos a função Vercel (src/index.ts). */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { getEnv } from './lib/env';

// Carrega segredos do .env.local da RAIZ do monorepo só no dev local — a função
// Vercel recebe as vars do ambiente e nunca importa este arquivo. Resolve a raiz
// a partir do próprio arquivo (o `dev:api` roda com cwd em apps/api). `getEnv` é
// lazy, então basta rodar antes da 1ª leitura. Silencioso se o arquivo faltar.
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: [resolve(raiz, '.env.local'), resolve(raiz, '.env')] });

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console -- log de bootstrap do servidor local (dev)
  console.log(`[api] ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
