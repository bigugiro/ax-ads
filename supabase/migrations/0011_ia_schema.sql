-- ============================================================================
-- Sprint 6 — Studio criativo IA: geração de copy/headlines (Sonnet) e
-- classificação (Haiku), com log de custo por geração.
-- Tabelas: criativos, variacoes_criativo, geracoes_ia. Dado de tenant.
-- ============================================================================

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_criativo') then
    create type tipo_criativo as enum ('copy', 'headline', 'imagem');
  end if;
  if not exists (select 1 from pg_type where typname = 'origem_criativo') then
    create type origem_criativo as enum ('ia', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_criativo') then
    create type status_criativo as enum ('rascunho', 'aprovado', 'descartado');
  end if;
  if not exists (select 1 from pg_type where typname = 'modelo_ia') then
    create type modelo_ia as enum ('haiku', 'sonnet');
  end if;
end
$$;

-- ----- criativos (o "briefing"/conjunto — cada variação vive em variacoes_criativo) -----
create table if not exists public.criativos (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo       tipo_criativo not null,
  conteudo   text not null, -- o briefing/prompt que originou as variações
  origem     origem_criativo not null default 'ia',
  status     status_criativo not null default 'rascunho',
  created_at timestamptz not null default now()
);
create index if not exists idx_criativos_agencia on public.criativos (agencia_id);
create index if not exists idx_criativos_cliente on public.criativos (cliente_id);

-- ----- variacoes_criativo (cada texto gerado/manual dentro do criativo) -----
create table if not exists public.variacoes_criativo (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null references public.agencias(id) on delete cascade,
  criativo_id uuid not null references public.criativos(id) on delete cascade,
  conteudo    text not null,
  metrica_ref text, -- referência livre (ex.: external_id de anúncio) — Sprint 8 amplia
  created_at  timestamptz not null default now()
);
create index if not exists idx_variacoes_agencia on public.variacoes_criativo (agencia_id);
create index if not exists idx_variacoes_criativo on public.variacoes_criativo (criativo_id);

-- ----- geracoes_ia (log de custo — toda chamada à Anthropic passa por aqui) -----
create table if not exists public.geracoes_ia (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  modelo     modelo_ia not null,
  prompt     text not null,
  resultado  jsonb not null,
  tokens_in  integer not null check (tokens_in >= 0),
  tokens_out integer not null check (tokens_out >= 0),
  custo      numeric(10, 6) not null check (custo >= 0), -- USD, 6 casas (custo por chamada é fração de centavo)
  created_at timestamptz not null default now()
);
create index if not exists idx_geracoes_agencia on public.geracoes_ia (agencia_id);
create index if not exists idx_geracoes_cliente_data on public.geracoes_ia (cliente_id, created_at desc);
