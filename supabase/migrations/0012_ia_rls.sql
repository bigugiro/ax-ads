-- ============================================================================
-- Sprint 6 — RLS do domínio de IA/criativos
-- Mesmo guard-rail das demais tabelas de tenant: select por agência;
-- insert/update/delete exigem gestor+ (ação `gerenciar_criativos`).
-- ============================================================================

alter table public.criativos          enable row level security;
alter table public.variacoes_criativo enable row level security;
alter table public.geracoes_ia        enable row level security;

alter table public.criativos          force row level security;
alter table public.variacoes_criativo force row level security;
alter table public.geracoes_ia        force row level security;

do $$
declare
  t text;
begin
  foreach t in array array['criativos', 'variacoes_criativo', 'geracoes_ia']
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

    execute format('drop policy if exists %1$I_delete on public.%1$I', t);
    execute format(
      'create policy %1$I_delete on public.%1$I for delete
         using (agencia_id = app.current_agencia_id() and app.tem_nivel_minimo(''gestor''))', t);
  end loop;
end
$$;
