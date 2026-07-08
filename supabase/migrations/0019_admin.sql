-- ============================================================================
-- Sprint 10 — Admin mínimo (operador do SaaS): flag `super_admin` em
-- `usuarios`. NENHUMA policy de RLS lê/depende disto — as rotas /admin/*
-- usam a SERVICE ROLE deliberadamente (visibilidade cross-tenant é o
-- propósito da rota) e checam este campo no backend antes de qualquer
-- query privilegiada. Nunca setar via API — só via SQL direto (operador).
-- ============================================================================

alter table public.usuarios add column if not exists super_admin boolean not null default false;
