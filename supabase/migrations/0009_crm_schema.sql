-- ============================================================================
-- Sprint 5 — CRM + automação: pipeline kanban, leads e automações
-- Tabelas: pipelines, estagios, leads, eventos_lead, automacoes,
-- execucoes_automacao. Toda tabela carrega agencia_id direto (RLS barata).
-- ============================================================================

-- ----- Enums -----
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_lead') then
    create type status_lead as enum ('aberto', 'ganho', 'perdido');
  end if;
  if not exists (select 1 from pg_type where typname = 'gatilho_automacao') then
    create type gatilho_automacao as enum ('lead_criado', 'lead_mudou_estagio');
  end if;
end
$$;

-- ----- pipelines (um funil de vendas por cliente, tipicamente) -----
create table if not exists public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists idx_pipelines_agencia on public.pipelines (agencia_id);
create index if not exists idx_pipelines_cliente on public.pipelines (cliente_id);

-- ----- estagios (colunas do kanban) -----
create table if not exists public.estagios (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null references public.agencias(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  nome        text not null check (char_length(nome) between 1 and 80),
  ordem       integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (pipeline_id, nome)
);
create index if not exists idx_estagios_agencia on public.estagios (agencia_id);
create index if not exists idx_estagios_pipeline on public.estagios (pipeline_id, ordem);

-- ----- leads -----
-- `status` é o desfecho do funil (aberto/ganho/perdido) — independente do
-- `estagio_id` (posição visual no kanban), para não perder o histórico de
-- conversão quando alguém renomeia ou reordena as colunas.
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estagio_id uuid not null references public.estagios(id),
  nome       text not null check (char_length(nome) between 1 and 160),
  contato    text not null check (char_length(contato) between 1 and 160),
  origem     text not null default 'manual' check (char_length(origem) between 1 and 60),
  valor      numeric(12, 2) check (valor is null or valor >= 0),
  status     status_lead not null default 'aberto',
  created_at timestamptz not null default now()
);
create index if not exists idx_leads_agencia on public.leads (agencia_id);
create index if not exists idx_leads_cliente on public.leads (cliente_id);
create index if not exists idx_leads_estagio on public.leads (estagio_id);

-- ----- eventos_lead (linha do tempo: contatos, mudanças, automações) -----
create table if not exists public.eventos_lead (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  tipo       text not null check (char_length(tipo) between 1 and 60),
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_eventos_lead_agencia on public.eventos_lead (agencia_id);
create index if not exists idx_eventos_lead_lead on public.eventos_lead (lead_id, created_at desc);

-- ----- automacoes -----
-- condicoes: objeto simples (ex.: {"origem":"meta_ads"}) — TODAS as chaves
-- precisam bater; vazio = dispara sempre. acoes: lista ordenada de passos,
-- ex.: [{"tipo":"mudar_estagio","estagio_nome":"Contatado"}].
create table if not exists public.automacoes (
  id         uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 120),
  gatilho    gatilho_automacao not null,
  condicoes  jsonb not null default '{}',
  acoes      jsonb not null default '[]',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_automacoes_agencia on public.automacoes (agencia_id);
create index if not exists idx_automacoes_cliente_gatilho on public.automacoes (cliente_id, gatilho) where ativo;

-- ----- execucoes_automacao (auditoria própria do motor de regras) -----
create table if not exists public.execucoes_automacao (
  id           uuid primary key default gen_random_uuid(),
  agencia_id   uuid not null references public.agencias(id) on delete cascade,
  automacao_id uuid not null references public.automacoes(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  resultado    jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_execucoes_agencia on public.execucoes_automacao (agencia_id);
create index if not exists idx_execucoes_automacao on public.execucoes_automacao (automacao_id, created_at desc);
