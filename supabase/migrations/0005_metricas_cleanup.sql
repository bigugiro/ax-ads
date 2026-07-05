-- ============================================================================
-- Sprint 1 — Limpeza de métricas órfãs
-- `metricas_diarias.entidade_id` é polimórfico (campanha|conjunto|anuncio),
-- então não há FK com cascade: ao apagar uma entidade do espelho, as métricas
-- ficariam órfãs. Estes triggers garantem a limpeza em QUALQUER caminho de
-- deleção (desconectar conta, apagar cliente, re-estruturação do espelho).
--
-- SECURITY INVOKER (padrão): a deleção roda sob o papel corrente e a RLS de
-- `metricas_diarias` continua valendo — quem pode apagar a entidade (gestor+
-- da agência) pode apagar as métricas dela; ninguém escala privilégio aqui.
-- ============================================================================

create or replace function app.limpar_metricas_da_entidade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.metricas_diarias
  where entidade_tipo = tg_argv[0]::entidade_metrica
    and entidade_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_campanhas_limpa_metricas on public.campanhas;
create trigger trg_campanhas_limpa_metricas
  after delete on public.campanhas
  for each row execute function app.limpar_metricas_da_entidade('campanha');

drop trigger if exists trg_conjuntos_limpa_metricas on public.conjuntos;
create trigger trg_conjuntos_limpa_metricas
  after delete on public.conjuntos
  for each row execute function app.limpar_metricas_da_entidade('conjunto');

drop trigger if exists trg_anuncios_limpa_metricas on public.anuncios;
create trigger trg_anuncios_limpa_metricas
  after delete on public.anuncios
  for each row execute function app.limpar_metricas_da_entidade('anuncio');
