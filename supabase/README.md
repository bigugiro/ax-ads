# Supabase — banco, migrations e RLS

Este diretório contém o schema versionado (migrations SQL), as políticas **RLS** e os seeds (catálogo de estratégias — Sprint 4).

## Aplicar migrations (projeto remoto)

1. Preencha `DATABASE_URL` no `.env` da raiz (Supabase → Project Settings → Database → Connection string → URI).
2. Na raiz do repo:

   ```bash
   npm run db:migrate
   ```

O runner (`scripts/db-migrate.mjs`) é **idempotente**: registra o que já aplicou em `public.schema_migrations` e roda cada arquivo em transação. Rodar de novo é seguro.

> Alternativa: colar o conteúdo dos arquivos em `migrations/` no **SQL Editor** do painel Supabase, na ordem numérica.

## Ordem das migrations

| Arquivo                       | Conteúdo                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_init_tenancy.sql`       | Enums, tabelas `agencias`/`usuarios`/`clientes`/`audit_log`, funções `app.current_agencia_id()`, `app.current_papel()`, `app.tem_nivel_minimo()`                |
| `0002_rls_policies.sql`       | `enable/force row level security` + policies de isolamento por `agencia_id`                                                                                     |
| `0003_ads_data.sql`           | Espelho do `AdsProvider`: `contas_anuncio`/`campanhas`/`conjuntos`/`anuncios`/`metricas_diarias`                                                                |
| `0004_ads_rls.sql`            | RLS do domínio de anúncios (mesmo padrão: select por agência, insert/update/delete gestor+)                                                                     |
| `0005_metricas_cleanup.sql`   | Trigger de limpeza de métricas órfãs                                                                                                                            |
| `0006_estrategias_schema.sql` | Catálogo global `estrategias`/`estrategia_versoes` (sem `agencia_id` — conteúdo curado) + `estrategias_aplicadas`/`estrategia_checklist_itens` (dado de tenant) |
| `0007_estrategias_rls.sql`    | RLS: catálogo global só-leitura para `authenticated`; aplicações/checklist com o padrão de tenant (select por agência, insert/update gestor+)                   |
| `0008_estrategias_seed.sql`   | Seed idempotente (`on conflict (slug)`) das 15 estratégias da Seção 6.4 do plano                                                                                |
| `0009_crm_schema.sql`         | `pipelines`/`estagios`/`leads`/`eventos_lead`/`automacoes`/`execucoes_automacao` (dado de tenant)                                                               |
| `0010_crm_rls.sql`            | RLS do domínio de CRM (mesmo padrão: select por agência, insert/update/delete gestor+)                                                                          |

## Modelo de segurança (RLS)

- O **backend usa o JWT do usuário** ao falar com o Postgres → as policies RLS são aplicadas automaticamente. Isolamento entre tenants é garantido no banco, não só no código.
- A **service role** (chave `SUPABASE_SERVICE_ROLE_KEY`) **bypassa RLS** e é usada apenas para: signup/provisionamento de agência, escrita de `audit_log` e jobs (cron).
- As funções `app.*` são `SECURITY DEFINER` para poderem ler `usuarios` sem recursão nas próprias policies.

Isolamento é coberto por testes de integração em `apps/api` (usuários de agências distintas não enxergam dados um do outro).
