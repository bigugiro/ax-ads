-- ============================================================================
-- Sprint 7 — RLS do domínio de PDCA
-- Mesmo guard-rail das demais tabelas de tenant: select por agência;
-- insert/update/delete exigem gestor+ (ação `aprovar_recomendacao`, já
-- existente no mapa de papéis desde a fundação).
-- ============================================================================

alter table public.recomendacoes    enable row level security;
alter table public.anomalias        enable row level security;
alter table public.regras_otimizacao enable row level security;

alter table public.recomendacoes    force row level security;
alter table public.anomalias        force row level security;
alter table public.regras_otimizacao force row level security;

do $$
declare
  t text;
begin
  foreach t in array array['recomendacoes', 'anomalias', 'regras_otimizacao']
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
