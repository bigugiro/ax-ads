/** Servidor local (dev). Em produção usamos a função Vercel (src/index.ts). */
import { createApp } from './app';
import { getEnv } from './lib/env';

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console -- log de bootstrap do servidor local (dev)
  console.log(`[api] ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
