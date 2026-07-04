// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'playwright-report/**',
      'test-results/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Segurança: proibir vazamento acidental — sem console solto no código de produção.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Arquivos de config/teste/scripts: console liberado.
  {
    files: [
      '**/*.config.{js,ts,mjs,cjs}',
      '**/*.{test,spec,integration.test}.{ts,tsx}',
      '**/tests/**',
      'scripts/**',
      '**/*.setup.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  // Configs, scripts e e2e fora do programa TS: desliga regras type-aware.
  {
    files: ['**/*.config.{js,ts,mjs,cjs}', 'scripts/**', '**/*.setup.ts', '*.setup.ts', 'tests/**'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
