-- ============================================================================
-- Sprint 0 — Fundação: schema de tenancy & acesso
-- Tabelas: agencias, usuarios, clientes, audit_log
-- Toda tabela carrega agencia_id (direto) e terá RLS (ver 0002_rls_policies.sql).
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Schema isolado para funções auxiliares de autorização.
create schema if not exists app;

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'papel') then
    create type papel as enum ('owner', 'gestor', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'plano_tipo') then
    create type plano_tipo as enum ('free', 'starter', 'pro', 'agency');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_tenant') then
    create type status_tenant as enum ('ativo', 'inativo', 'suspenso');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_cliente') then
    create type status_cliente as enum ('ativo', 'pausado', 'arquivado');
  end if;
end
$$;

-- ----- agencias (tenant raiz) -----
create table if not exists public.agencias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 1 and 120),
  plano      plano_tipo not null default 'free',
  status     status_tenant not null default 'ativo',
  created_at timestamptz not null default now()
);

-- ----- usuarios (vinculados ao Supabase Auth via auth_supabase_id) -----
create table if not exists public.usuarios (
  id               uuid primary key default gen_random_uuid(),
  agencia_id       uuid not null references public.agencias(id) on delete cascade,
  nome             text not null check (char_length(nome) between 1 and 120),
  email            text not null check (position('@' in email) > 1),
  papel            papel not null default 'gestor',
  auth_supabase_id uuid not null unique, -- = auth.users.id
  created_at       timestamptz not null default now(),
  unique (agencia_id, email)
);
create index if not exists idx_usuarios_agencia on public.usuarios (agencia_id);
create index if not exists idx_usuarios_auth on public.usuarios (auth_supabase_id);

-- ----- clientes (o e-commerce atendido) -----
create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 120),
  nicho      text check (nicho is null or char_length(nicho) <= 80),
  site       text,
  status     status_cliente not null default 'ativo',
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_agencia on public.clientes (agencia_id);

-- ----- audit_log (rastreabilidade — escrito pelo backend com service role) -----
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  acao       text not null,
  entidade   text not null,
  antes      jsonb,
  depois     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_agencia_data on public.audit_log (agencia_id, created_at desc);

-- ----- Funções auxiliares de autorização -----
-- SECURITY DEFINER: rodam como owner e por isso NÃO disparam RLS ao ler `usuarios`
-- (evita recursão infinita nas policies que dependem destas funções).

create or replace function app.current_agencia_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.agencia_id
  from public.usuarios u
  where u.auth_supabase_id = auth.uid()
  limit 1
$$;

create or replace function app.current_papel()
returns papel
language sql
stable
security definer
set search_path = public
as $$
  select u.papel
  from public.usuarios u
  where u.auth_supabase_id = auth.uid()
  limit 1
$$;

-- Papel com privilégio >= ao mínimo (viewer < gestor < owner).
create or replace function app.tem_nivel_minimo(minimo papel)
returns boolean
language sql
stable
as $$
  select case app.current_papel()
    when 'owner'  then true
    when 'gestor' then minimo in ('gestor', 'viewer')
    when 'viewer' then minimo = 'viewer'
    else false
  end
$$;

-- Permissões de execução (as funções são o guard-rail das policies).
grant usage on schema app to authenticated, anon;
grant execute on function app.current_agencia_id() to authenticated, anon;
grant execute on function app.current_papel() to authenticated, anon;
grant execute on function app.tem_nivel_minimo(papel) to authenticated, anon;
