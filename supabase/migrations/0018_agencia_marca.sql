-- ============================================================================
-- Sprint 10 — White-label básico (Seção 8: "marca do cliente"). Campos
-- opcionais na própria `agencias` — sem tabela nova, sem domínio customizado
-- (fora de escopo desta sprint). RLS de update já exigia owner desde
-- 0002_rls_policies.sql (`agencias_update`) — nada novo a fazer em RLS.
-- ============================================================================

alter table public.agencias add column if not exists marca_nome text
  check (marca_nome is null or char_length(marca_nome) between 1 and 60);
alter table public.agencias add column if not exists marca_cor text
  check (marca_cor is null or marca_cor ~ '^#[0-9a-fA-F]{6}$');
alter table public.agencias add column if not exists marca_logo_url text;
