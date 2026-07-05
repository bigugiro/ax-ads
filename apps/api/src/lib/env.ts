/** Validação das variáveis de ambiente do backend (fail-fast, sem vazar valores). */
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Origens permitidas para CORS (CSV). Em dev, default para o Vite local.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // Segredo que autoriza os jobs de cron (Vercel envia em Authorization: Bearer).
  // Opcional: sem ele, as rotas de cron respondem 503 (fail-closed).
  CRON_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Lê e valida o ambiente uma única vez. Lança erro claro se algo faltar. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    // Nunca logamos valores — apenas quais chaves faltaram/são inválidas.
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${campos}`);
  }
  cached = parsed.data;
  return cached;
}

export function corsOrigins(): string[] {
  return getEnv()
    .CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
