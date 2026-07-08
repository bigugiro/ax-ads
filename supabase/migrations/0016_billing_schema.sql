-- ============================================================================
-- Sprint 9 — Billing & onboarding: assinaturas (Seção 4 do plano).
-- `plano` reaproveita o enum `plano_tipo` já existente em `agencias` (Sprint 0).
-- Uma assinatura por agência (unique). Escrita só via service role (signup,
-- checkout e webhook do Pagar.me) — mesmo padrão de `audit_log`.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_assinatura') then
    create type status_assinatura as enum ('trialing', 'ativa', 'inadimplente', 'cancelada');
  end if;
end
$$;

create table if not exists public.assinaturas (
  id                      uuid primary key default gen_random_uuid(),
  agencia_id              uuid not null unique references public.agencias(id) on delete cascade,
  plano                   plano_tipo not null,
  status                  status_assinatura not null default 'trialing',
  pagarme_customer_id     text,
  pagarme_subscription_id text,
  created_at              timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create index if not exists idx_assinaturas_agencia on public.assinaturas (agencia_id);
