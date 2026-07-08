-- ============================================================================
-- Sprint 7 — Motor PDCA (Seção 7 do plano): Check (anomalias), Act
-- (recomendações) e os guardrails (regras_otimizacao) do ciclo de melhoria
-- contínua. Dado de tenant.
--
-- Decisão de design: `recomendacoes`/`anomalias` guardam `campanha_id`
-- (nullable) além do `alvo_entidade` textual do plano — o texto é para
-- exibição; o id estruturado é o que permite "aplicar" a recomendação de
-- verdade via AdsProvider (pausar a campanha certa), não só marcar status.
-- ============================================================================

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_recomendacao') then
    create type tipo_recomendacao as enum
      ('realocar_budget', 'aplicar_estrategia', 'testar_criativo', 'pausar_campanha');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_recomendacao') then
    create type status_recomendacao as enum ('sugerida', 'aprovada', 'aplicada', 'rejeitada');
  end if;
  if not exists (select 1 from pg_type where typname = 'origem_recomendacao') then
    create type origem_recomendacao as enum ('ia', 'regra');
  end if;
  if not exists (select 1 from pg_type where typname = 'metrica_monitorada') then
    -- Sprint 7 monitora CAC (via cpa) e ROAS — os dois KPIs do CLAUDE.md
    -- ("Sempre otimizar para: ↓ CAC e ↑ ROAS"). Outras métricas ficam para
    -- iterações futuras do motor.
    create type metrica_monitorada as enum ('cpa', 'roas');
  end if;
  if not exists (select 1 from pg_type where typname = 'severidade_anomalia') then
    create type severidade_anomalia as enum ('baixa', 'media', 'alta');
  end if;
end
$$;

-- ----- recomendacoes (Plan/Act do ciclo) -----
create table if not exists public.recomendacoes (
  id                uuid primary key default gen_random_uuid(),
  agencia_id        uuid not null references public.agencias(id) on delete cascade,
  cliente_id        uuid not null references public.clientes(id) on delete cascade,
  campanha_id       uuid references public.campanhas(id) on delete cascade,
  tipo              tipo_recomendacao not null,
  alvo_entidade     text not null check (char_length(alvo_entidade) between 1 and 200),
  descricao         text not null,
  impacto_estimado  text not null,
  status            status_recomendacao not null default 'sugerida',
  origem            origem_recomendacao not null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_recomendacoes_agencia on public.recomendacoes (agencia_id);
create index if not exists idx_recomendacoes_cliente on public.recomendacoes (cliente_id, created_at desc);

-- ----- anomalias (Check do ciclo) -----
create table if not exists public.anomalias (
  id            uuid primary key default gen_random_uuid(),
  agencia_id    uuid not null references public.agencias(id) on delete cascade,
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  campanha_id   uuid references public.campanhas(id) on delete cascade,
  metrica       metrica_monitorada not null,
  valor         numeric(12, 4) not null,
  esperado      numeric(12, 4) not null,
  severidade    severidade_anomalia not null,
  detectada_em  timestamptz not null default now()
);
create index if not exists idx_anomalias_agencia on public.anomalias (agencia_id);
create index if not exists idx_anomalias_cliente on public.anomalias (cliente_id, detectada_em desc);

-- ----- regras_otimizacao (guardrails que o gestor define — Do do ciclo) -----
create table if not exists public.regras_otimizacao (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 120),
  condicao   jsonb not null default '{}',
  acao       jsonb not null default '{}',
  guardrails jsonb not null default '{}',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_regras_agencia on public.regras_otimizacao (agencia_id);
create index if not exists idx_regras_cliente on public.regras_otimizacao (cliente_id);
