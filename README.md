# AX Ads

SaaS multi-tenant de **tráfego pago + automação + IA** para gestores/agências de **e-commerce**. Mobile-first, PWA instalável. Feature de destaque: **aba Estratégias** (biblioteca de padrões comprovados). Motor de valor: **PDCA / melhoria contínua**.

> Contrato do agente: [`CLAUDE.md`](./CLAUDE.md). Fonte de verdade do escopo: [`plano-ax-ads-build.md`](./plano-ax-ads-build.md).

## Estrutura (monorepo — npm workspaces)

```
apps/web         React + Vite + Tailwind (PWA, bottom-nav mobile)
apps/api         Express (Vercel Functions)
packages/shared  tipos TS + schemas Zod compartilhados
supabase         migrations + policies RLS + seeds
tests            e2e Playwright
```

## Pré-requisitos

- Node.js `>=20` (recomendado: 22 — ver `.nvmrc`)
- npm `>=10`
- Um projeto **Supabase** (URL + keys) — ver `.env.example`

## Setup

```bash
# 1. Instalar dependências (todos os workspaces)
npm install

# 2. Configurar ambiente
cp .env.example .env
#   preencha SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL

# 3. Aplicar migrations no Supabase (ver supabase/README.md)

# 4. Rodar em dev
npm run dev:web    # front  (Vite)
npm run dev:api    # back   (Express)
```

## Scripts (raiz)

| Comando                 | O que faz                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run check`         | format:check + lint + typecheck + testes (porta de qualidade local) |
| `npm run lint`          | ESLint em todo o monorepo                                           |
| `npm run typecheck`     | `tsc -b` (TypeScript strict, project references)                    |
| `npm run test`          | Vitest (unit + integração)                                          |
| `npm run test:coverage` | Vitest com cobertura                                                |
| `npm run test:e2e`      | Playwright (e2e mobile)                                             |
| `npm run format`        | Prettier `--write`                                                  |

## Qualidade / segurança (não-negociável)

- **TypeScript strict**, sem `any` solto.
- **Mobile-first**: estilo base é mobile; `md:`/`lg:` só para ampliar.
- **RLS multi-tenant** por `agencia_id` em toda tabela; isolamento testado.
- Nunca logar tokens/segredos; `.env` fora do git.
- Toda rota valida input com **Zod** e checa papel (`owner`/`gestor`/`viewer`).
- CI (GitHub Actions) bloqueia merge se lint/tipos/testes falharem.

## Progresso por sprint

- [x] **Sprint 0 — Fundação** (em construção): monorepo, tooling, schema+RLS, Auth, design system mobile-first, harness de testes, CI.

Ver a sequência completa na Seção 8 do plano de build.
