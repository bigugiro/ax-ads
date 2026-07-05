-- ============================================================================
-- Sprint 1 — Contas & camada de dados: espelho sincronizado do AdsProvider
-- Tabelas: contas_anuncio, campanhas, conjuntos, anuncios, metricas_diarias
-- Toda tabela carrega agencia_id direto (RLS barata e à prova de joins) e o
-- vínculo hierárquico (cliente → conta → campanha → conjunto → anúncio).
-- ctr/cpa/roas são colunas geradas — coerência garantida pelo banco.
-- ============================================================================

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plataforma_ads') then
    create type plataforma_ads as enum ('demo', 'meta', 'google');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_conta') then
    create type status_conta as enum ('ativa', 'pausada', 'desconectada');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_entrega') then
    create type status_entrega as enum ('ativa', 'pausada', 'arquivada');
  end if;
  if not exists (select 1 from pg_type where typname = 'budget_tipo') then
    create type budget_tipo as enum ('diario', 'vitalicio');
  end if;
  if not exists (select 1 from pg_type where typname = 'entidade_metrica') then
    create type entidade_metrica as enum ('campanha', 'conjunto', 'anuncio');
  end if;
end
$$;

-- ----- contas_anuncio (conexão do cliente com uma plataforma) -----
-- token_ref guarda apenas a REFERÊNCIA no cofre — nunca o token em si.
-- Contas 'demo' não têm OAuth: token_ref fica null.
create table if not exists public.contas_anuncio (
  id                  uuid primary key default gen_random_uuid(),
  agencia_id          uuid not null references public.agencias(id) on delete cascade,
  cliente_id          uuid not null references public.clientes(id) on delete cascade,
  plataforma          plataforma_ads not null,
  external_account_id text not null check (char_length(external_account_id) between 1 and 120),
  nome                text not null check (char_length(nome) between 1 and 120),
  moeda               char(3) not null default 'BRL',
  token_ref           text,
  escopo              text,
  status              status_conta not null default 'ativa',
  ultimo_sync_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (cliente_id, plataforma, external_account_id)
);
create index if not exists idx_contas_agencia on public.contas_anuncio (agencia_id);
create index if not exists idx_contas_cliente on public.contas_anuncio (cliente_id);

-- ----- campanhas (espelho) -----
create table if not exists public.campanhas (
  id               uuid primary key default gen_random_uuid(),
  agencia_id       uuid not null references public.agencias(id) on delete cascade,
  conta_anuncio_id uuid not null references public.contas_anuncio(id) on delete cascade,
  external_id      text not null check (char_length(external_id) between 1 and 120),
  nome             text not null check (char_length(nome) between 1 and 200),
  objetivo         text not null,
  status           status_entrega not null default 'ativa',
  budget           numeric(12, 2) not null check (budget >= 0),
  budget_tipo      budget_tipo not null default 'diario',
  created_at       timestamptz not null default now(),
  unique (conta_anuncio_id, external_id)
);
create index if not exists idx_campanhas_agencia on public.campanhas (agencia_id);
create index if not exists idx_campanhas_conta on public.campanhas (conta_anuncio_id);

-- ----- conjuntos (adsets/adgroups; budget null quando o orçamento é CBO) -----
create table if not exists public.conjuntos (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null references public.agencias(id) on delete cascade,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 120),
  nome        text not null check (char_length(nome) between 1 and 200),
  status      status_entrega not null default 'ativa',
  budget      numeric(12, 2) check (budget is null or budget >= 0),
  publico     jsonb,
  created_at  timestamptz not null default now(),
  unique (campanha_id, external_id)
);
create index if not exists idx_conjuntos_agencia on public.conjuntos (agencia_id);
create index if not exists idx_conjuntos_campanha on public.conjuntos (campanha_id);

-- ----- anuncios -----
create table if not exists public.anuncios (
  id           uuid primary key default gen_random_uuid(),
  agencia_id   uuid not null references public.agencias(id) on delete cascade,
  conjunto_id  uuid not null references public.conjuntos(id) on delete cascade,
  external_id  text not null check (char_length(external_id) between 1 and 120),
  nome         text not null check (char_length(nome) between 1 and 200),
  status       status_entrega not null default 'ativa',
  criativo_ref text,
  created_at   timestamptz not null default now(),
  unique (conjunto_id, external_id)
);
create index if not exists idx_anuncios_agencia on public.anuncios (agencia_id);
create index if not exists idx_anuncios_conjunto on public.anuncios (conjunto_id);

-- ----- metricas_diarias (snapshot por entidade e dia) -----
-- entidade_id aponta para a linha do espelho local (campanhas/conjuntos/anuncios).
-- ctr/cpa/roas derivados no banco: impossível ficarem incoerentes com a base.
create table if not exists public.metricas_diarias (
  id            uuid primary key default gen_random_uuid(),
  agencia_id    uuid not null references public.agencias(id) on delete cascade,
  entidade_tipo entidade_metrica not null,
  entidade_id   uuid not null,
  data          date not null,
  impressoes    integer not null default 0 check (impressoes >= 0),
  cliques       integer not null default 0 check (cliques >= 0 and cliques <= impressoes),
  gasto         numeric(12, 2) not null default 0 check (gasto >= 0),
  conversoes    integer not null default 0 check (conversoes >= 0 and conversoes <= cliques),
  receita       numeric(12, 2) not null default 0 check (receita >= 0),
  ctr           numeric(8, 6) generated always as (
                  case when impressoes > 0 then round(cliques::numeric / impressoes, 6) else 0 end
                ) stored,
  cpa           numeric(12, 2) generated always as (
                  case when conversoes > 0 then round(gasto / conversoes, 2) else null end
                ) stored,
  roas          numeric(10, 4) generated always as (
                  case when gasto > 0 then round(receita / gasto, 4) else null end
                ) stored,
  created_at    timestamptz not null default now(),
  unique (entidade_tipo, entidade_id, data)
);
create index if not exists idx_metricas_agencia_data on public.metricas_diarias (agencia_id, data desc);
create index if not exists idx_metricas_entidade on public.metricas_diarias (entidade_tipo, entidade_id, data desc);
