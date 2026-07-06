-- ============================================================================
-- Sprint 4 — RLS do domínio de Estratégias
--
-- Catálogo GLOBAL (estrategias, estrategia_versoes): leitura liberada a
-- qualquer usuário autenticado (é conteúdo curado da plataforma, não dado de
-- tenant); escrita só via service role (seed/administração — sem policy de
-- insert/update/delete, então `authenticated` fica bloqueado por padrão).
--
-- Dado de tenant (estrategias_aplicadas, checklist): mesmo padrão das demais
-- tabelas — select por agência; insert/update exige gestor+ (`aplicar_estrategia`
-- é ação de gestor+ no mapa de papéis).
-- ============================================================================

alter table public.estrategias                enable row level security;
alter table public.estrategia_versoes         enable row level security;
alter table public.estrategias_aplicadas      enable row level security;
alter table public.estrategia_checklist_itens enable row level security;

alter table public.estrategias                force row level security;
alter table public.estrategia_versoes         force row level security;
alter table public.estrategias_aplicadas      force row level security;
alter table public.estrategia_checklist_itens force row level security;

-- ----- catálogo global: só leitura para quem está autenticado -----
drop policy if exists estrategias_select on public.estrategias;
create policy estrategias_select on public.estrategias
  for select
  to authenticated
  using (true);

drop policy if exists estrategia_versoes_select on public.estrategia_versoes;
create policy estrategia_versoes_select on public.estrategia_versoes
  for select
  to authenticated
  using (true);

-- ----- estrategias_aplicadas / estrategia_checklist_itens (dado de tenant) -----
do $$
declare
  t text;
begin
  foreach t in array array['estrategias_aplicadas', 'estrategia_checklist_itens']
  loop
    execute format('drop policy if exists %1$I_select on public.%1$I', t);
    execute format(
      'create policy %1$I_select on public.%1$I for select
         using (agencia_id = app.current_agencia_id())', t);

    execute format('drop policy if exists %1$I_insert on public.%1$I', t);
    execute format(
      'create policy %1$I_insert on public.%1$I for insert
         with check (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo(''gestor''))', t);

    execute format('drop policy if exists %1$I_update on public.%1$I', t);
    execute format(
      'create policy %1$I_update on public.%1$I for update
         using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo(''gestor''))
         with check (agencia_id = app.current_agencia_id())', t);
  end loop;
end
$$;
