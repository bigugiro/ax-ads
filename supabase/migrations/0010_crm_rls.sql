-- ============================================================================
-- Sprint 5 — RLS do domínio de CRM
-- Mesmo guard-rail das demais tabelas: select por agência; insert/update/delete
-- exigem gestor+ (ação `gerenciar_crm`). Motor de automação roda com o client
-- do usuário que criou/moveu o lead — RLS se aplica normalmente.
-- ============================================================================

alter table public.pipelines           enable row level security;
alter table public.estagios            enable row level security;
alter table public.leads               enable row level security;
alter table public.eventos_lead        enable row level security;
alter table public.automacoes          enable row level security;
alter table public.execucoes_automacao enable row level security;

alter table public.pipelines           force row level security;
alter table public.estagios            force row level security;
alter table public.leads               force row level security;
alter table public.eventos_lead        force row level security;
alter table public.automacoes          force row level security;
alter table public.execucoes_automacao force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'pipelines', 'estagios', 'leads', 'eventos_lead', 'automacoes', 'execucoes_automacao'
  ]
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
