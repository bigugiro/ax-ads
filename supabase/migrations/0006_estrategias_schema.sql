-- ============================================================================
-- Sprint 4 — Aba Estratégias (feature de destaque, Seção 6 do plano)
-- Tabelas: estrategias (catálogo GLOBAL), estrategia_versoes (histórico do
-- catálogo), estrategias_aplicadas (instância por cliente) e
-- estrategia_checklist_itens (trabalho padrão executável).
--
-- Decisão de design: `estrategias`/`estrategia_versoes` são conteúdo CURADO
-- da plataforma (igual para todas as agências) — não carregam `agencia_id`
-- porque não são dado de tenant. `estrategias_aplicadas`/`checklist_itens`
-- SÃO dado de tenant (aplicação de um cliente específico) e seguem a regra 3
-- do CLAUDE.md: `agencia_id` direto + RLS.
-- ============================================================================

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'canal_estrategia') then
    create type canal_estrategia as enum ('meta', 'google', 'ambos');
  end if;
  if not exists (select 1 from pg_type where typname = 'nivel_estrategia') then
    create type nivel_estrategia as enum ('iniciante', 'avancado');
  end if;
  if not exists (select 1 from pg_type where typname = 'impacto_estrategia') then
    create type impacto_estrategia as enum ('cac_down', 'roas_up', 'faturamento_up');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_estrategia_aplicada') then
    create type status_estrategia_aplicada as enum
      ('analisando', 'aplicada', 'pausada', 'concluida');
  end if;
end
$$;

-- ----- estrategias (catálogo global, curado, versionado) -----
create table if not exists public.estrategias (
  id              uuid primary key default gen_random_uuid(),
  -- Chave estável p/ seed idempotente (upsert) — independe de acento/espaço do título.
  slug            text not null unique check (char_length(slug) between 1 and 80),
  titulo          text not null check (char_length(titulo) between 1 and 160),
  categoria       text not null check (char_length(categoria) between 1 and 80),
  canal           canal_estrategia not null,
  objetivo        text not null check (char_length(objetivo) between 1 and 160),
  quando_usar     text not null,
  impacto         impacto_estrategia[] not null default '{}',
  pre_requisitos  jsonb not null default '[]', -- string[]
  passos          jsonb not null default '[]', -- string[], ordem = índice do array
  guardrails      jsonb not null default '[]', -- string[]
  kpi_sucesso     text not null,
  nivel           nivel_estrategia not null default 'iniciante',
  versao          integer not null default 1 check (versao >= 1),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_estrategias_ativo on public.estrategias (ativo);
create index if not exists idx_estrategias_canal on public.estrategias (canal);

-- ----- estrategia_versoes (histórico de melhoria contínua do padrão) -----
create table if not exists public.estrategia_versoes (
  id            uuid primary key default gen_random_uuid(),
  estrategia_id uuid not null references public.estrategias(id) on delete cascade,
  versao        integer not null check (versao >= 1),
  mudanca       text not null,
  created_at    timestamptz not null default now(),
  unique (estrategia_id, versao)
);
create index if not exists idx_estrategia_versoes_estrategia on public.estrategia_versoes (estrategia_id);

-- ----- estrategias_aplicadas (instância por cliente — dado de tenant) -----
create table if not exists public.estrategias_aplicadas (
  id                uuid primary key default gen_random_uuid(),
  agencia_id        uuid not null references public.agencias(id) on delete cascade,
  cliente_id        uuid not null references public.clientes(id) on delete cascade,
  estrategia_id     uuid not null references public.estrategias(id),
  -- Versão do catálogo no momento da aplicação (rastreia "aplicado na v1, catálogo já é v2").
  estrategia_versao integer not null,
  status            status_estrategia_aplicada not null default 'analisando',
  aplicada_em       timestamptz,
  config            jsonb not null default '{}',
  resultado         jsonb,
  notas             text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_estrat_aplicadas_agencia on public.estrategias_aplicadas (agencia_id);
create index if not exists idx_estrat_aplicadas_cliente on public.estrategias_aplicadas (cliente_id);
-- Só uma aplicação "em andamento" por cliente+estratégia por vez (evita duplicidade
-- de checklist); reaplicar depois de concluída/pausada é permitido (histórico).
create unique index if not exists uq_estrat_aplicadas_ativa
  on public.estrategias_aplicadas (cliente_id, estrategia_id)
  where status in ('analisando', 'aplicada');

-- ----- estrategia_checklist_itens (trabalho padrão executável) -----
create table if not exists public.estrategia_checklist_itens (
  id                     uuid primary key default gen_random_uuid(),
  agencia_id             uuid not null references public.agencias(id) on delete cascade,
  estrategia_aplicada_id uuid not null references public.estrategias_aplicadas(id) on delete cascade,
  descricao              text not null,
  feito                  boolean not null default false,
  ordem                  integer not null default 0,
  created_at             timestamptz not null default now()
);
create index if not exists idx_checklist_agencia on public.estrategia_checklist_itens (agencia_id);
create index if not exists idx_checklist_aplicada on public.estrategia_checklist_itens (estrategia_aplicada_id, ordem);
