-- ============================================================================
-- Sprint 1 — RLS do domínio de anúncios
-- Mesmo guard-rail do Sprint 0: linha visível/alterável só pela própria agência.
-- Leitura: qualquer papel da agência. Escrita: gestor+ (conectar conta,
-- espelhar sync, operar campanha). Cron/jobs usam service role (bypassa RLS).
-- ============================================================================

alter table public.contas_anuncio   enable row level security;
alter table public.campanhas        enable row level security;
alter table public.conjuntos        enable row level security;
alter table public.anuncios         enable row level security;
alter table public.metricas_diarias enable row level security;

alter table public.contas_anuncio   force row level security;
alter table public.campanhas        force row level security;
alter table public.conjuntos        force row level security;
alter table public.anuncios         force row level security;
alter table public.metricas_diarias force row level security;

-- Padrão idêntico para as 5 tabelas: select por agência; insert/update/delete
-- exigem gestor+ e a linha presa à agência do usuário (with check).
do $$
declare
  t text;
begin
  foreach t in array array['contas_anuncio', 'campanhas', 'conjuntos', 'anuncios', 'metricas_diarias']
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
