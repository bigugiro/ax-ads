# CLAUDE.md — AX Ads

Contrato de trabalho do agente. **Ler antes de qualquer tarefa.** Fonte de verdade do escopo: `plano-ax-ads-build.md`.

## O que estamos construindo

SaaS multi-tenant de **tráfego pago + automação + IA** para gestores/agências que atendem **e-commerce**. Produto completo, **qualidade acima de velocidade**. Feature de destaque: **aba Estratégias** (biblioteca de padrões comprovados que o cliente aplica na conta). Motor de valor: **PDCA / melhoria contínua** sobre cada conta.

## Stack

React + Vite + TailwindCSS (front, **mobile-first**, PWA) · Node/Express em Vercel Functions (back) · Supabase Postgres + Auth + Storage com **RLS** (dados) · Vercel Cron (jobs) · Claude **Haiku** (classificação) e **Sonnet** (geração/análise) · Meta Marketing API + Google Ads API + CAPI · Pagar.me (billing) · Vitest + Playwright (testes) · TypeScript strict.

## Regras não-negociáveis

1. **Mobile-first.** Estilo base é mobile; usar `md:`/`lg:` só para ampliar. Nunca desktop-first.
2. **Segurança.** Nunca logar tokens/segredos. Tokens OAuth só criptografados no cofre, nunca no front. `.env` fora do git.
3. **Multi-tenant.** Toda tabela nasce com `agencia_id` + política **RLS**. Testar isolamento entre tenants.
4. **Testes junto do código.** Feature sem teste = não pronta. Unit (lógica), integração (API+RLS), e2e (fluxo mobile). Alvo ≥80% na lógica crítica.
5. **Auditoria.** Toda alteração de budget/status de campanha escreve em `audit_log`.
6. **Um sprint por vez**, na ordem do plano. Não pular. Fechar sprint só com CI verde.
7. **Validação de input** com Zod em toda rota. Checar papel do usuário (`owner`/`gestor`/`viewer`).

## Definição de Pronto (DoD)

- [ ] Código tipado (TS strict), sem `any` solto
- [ ] Testes escritos e verdes (unit + integração; e2e se houver fluxo de UI)
- [ ] RLS aplicada e testada nas tabelas novas
- [ ] Nenhum segredo em log ou commit
- [ ] Lint + Prettier + tipos passando (CI verde)
- [ ] UI validada em viewport mobile primeiro

## Estrutura do repo

```
/apps/web        React/Vite/Tailwind (PWA, bottom-nav)
/apps/api        Express (Vercel Functions)
/packages/shared tipos TS + schemas Zod
/supabase        migrations + policies RLS + seeds (catálogo de estratégias)
/tests           e2e Playwright
```

## Navegação (bottom-nav mobile)

Dashboard · Campanhas · **Estratégias** · CRM · Mais

## Commits

Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `refactor:`. Um commit por unidade lógica; nunca commitar segredo.

## Fora de escopo

Segurança do trabalho (NR) e meio ambiente não se aplicam a este produto. Segurança da **informação** e LGPD, sim — críticas.

## Sempre otimizar para

↓ CAC (custo de aquisição) e ↑ ROAS/faturamento — do cliente-final e do próprio SaaS. Se um recurso não move nenhum dos dois, questionar antes de construir.
