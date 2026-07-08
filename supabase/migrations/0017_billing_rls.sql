-- ============================================================================
-- Sprint 9 — RLS de `assinaturas`. Mesmo padrão de `audit_log`: leitura por
-- agência (gestor+); ESCRITA EXCLUSIVA da service role (signup, checkout e
-- webhook do Pagar.me rodam no backend, nunca com o JWT do usuário) — por
-- isso não existe policy de insert/update/delete para `authenticated`.
-- ============================================================================

alter table public.assinaturas enable row level security;
alter table public.assinaturas force row level security;

drop policy if exists assinaturas_select on public.assinaturas;
create policy assinaturas_select on public.assinaturas
  for select using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('gestor'));
