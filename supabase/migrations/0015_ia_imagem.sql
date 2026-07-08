-- ============================================================================
-- Sprint 8 — Criativos visuais IA: adiciona 'imagem' ao enum modelo_ia para
-- o log de custo (geracoes_ia) cobrir também gerações de imagem. O provider
-- de imagem em si é uma porta (packages/shared) com implementação `demo`
-- (placeholder determinístico, sem chamada externa) até um provedor real
-- (OpenAI/Google/etc.) ser plugado — mesma decisão do AdsProvider (Sprint 1).
-- `tipo_criativo` e `criativos.tipo='imagem'` já existiam desde o Sprint 6.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'modelo_ia' and e.enumlabel = 'imagem'
  ) then
    alter type modelo_ia add value 'imagem';
  end if;
end
$$;
