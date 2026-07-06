import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit + integração (Node). E2E fica no Playwright, fora daqui.
    include: ['{packages,apps}/*/src/**/*.{test,integration.test}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    // Os testes de integração batem no MESMO Supabase remoto. Rodar os arquivos
    // em paralelo gera contenção (e derruba workers: "Worker exited unexpectedly").
    // Serializar os arquivos torna a suíte determinística — reforça o provider
    // singleton em memória e evita disputa no banco. Custo de tempo é aceitável.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reports: ['text', 'html'],
      reportsDirectory: './coverage',
      // Foco: lógica de negócio crítica (papéis, schemas, providers, helpers puros).
      // Glue de framework (bootstrap Express, client Supabase) fica fora da meta.
      include: [
        'packages/shared/src/**/*.ts',
        'apps/api/src/lib/**/*.ts',
        'apps/api/src/providers/**/*.ts',
      ],
      exclude: ['**/*.{test,integration.test}.ts', '**/index.ts', '**/*.d.ts'],
      // Alvo do CLAUDE.md: ≥80% na lógica de negócio crítica.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
