-- ============================================================================
-- Sprint 0 — RLS multi-tenant por agencia_id
-- Guard-rail: usuário só enxerga/altera linhas da própria agência.
-- O backend usa o JWT do usuário (RLS aplica). Operações privilegiadas
-- (signup, escrita de audit_log, cron) usam a service role, que bypassa RLS.
-- ============================================================================

alter table public.agencias  enable row level security;
alter table public.usuarios  enable row level security;
alter table public.clientes  enable row level security;
alter table public.audit_log enable row level security;

-- Força RLS inclusive para o dono das tabelas (defesa em profundidade).
alter table public.agencias  force row level security;
alter table public.usuarios  force row level security;
alter table public.clientes  force row level security;
alter table public.audit_log force row level security;

-- ----- agencias -----
-- Ver apenas a própria agência; alterar só owner. Insert é via service role (signup).
drop policy if exists agencias_select on public.agencias;
create policy agencias_select on public.agencias
  for select using (id = app.current_agencia_id());

drop policy if exists agencias_update on public.agencias;
create policy agencias_update on public.agencias
  for update
  using (id = app.current_agencia_id() and app.tem_nivel_minimo('owner'))
  with check (id = app.current_agencia_id());

-- ----- usuarios -----
-- Ver membros da própria agência; gerenciar (insert/update/delete) só owner.
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using (agencia_id = app.current_agencia_id());

drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert
  with check (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('owner'));

drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update
  using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('owner'))
  with check (agencia_id = app.current_agencia_id());

drop policy if exists usuarios_delete on public.usuarios;
create policy usuarios_delete on public.usuarios
  for delete
  using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('owner'));

-- ----- clientes -----
-- Ver todos da agência; criar/editar/excluir exige gestor+.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select using (agencia_id = app.current_agencia_id());

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
  for insert
  with check (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('gestor'));

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes
  for update
  using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('gestor'))
  with check (agencia_id = app.current_agencia_id());

drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes
  for delete
  using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('gestor'));

-- ----- audit_log -----
-- Somente leitura para a agência (gestor+); escrita é exclusiva da service role.
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo('gestor'));
