/** CRM + automação (Sprint 5): pipeline kanban, leads e automações de jornada. */
import type {
  Automacao,
  Cliente,
  CriarAutomacao,
  Estagio,
  GatilhoAutomacao,
  LeadComEstagio,
  PipelineComEstagios,
  StatusLead,
} from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, ApiError, apiPatch, apiPost } from '../lib/api';
import { fmtMoeda } from '../lib/format';

type Aba = 'kanban' | 'automacoes';

const ORIGENS = ['manual', 'meta_ads', 'google_ads', 'organico', 'indicacao'];

export function CrmPage() {
  const [aba, setAba] = useState<Aba>('kanban');
  const [clienteId, setClienteId] = useState('');

  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: () => apiGet<Cliente[]>('/clientes'),
  });
  const clientes = clientesQuery.data ?? [];
  if (!clienteId && clientes.length > 0) setClienteId(clientes[0]!.id);

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <h1 id="page-title" className="font-display text-2xl font-extrabold">
          CRM
        </h1>
        <p className="text-sm text-muted">Pipeline de leads e automações de jornada.</p>
      </div>

      {clientes.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Cliente</span>
          <select
            className="field text-sm"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            aria-label="Cliente"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        role="tablist"
        aria-label="Seção"
        className="flex rounded-xl border border-line bg-surface p-0.5"
      >
        <button
          role="tab"
          aria-selected={aba === 'kanban'}
          onClick={() => setAba('kanban')}
          className={`min-h-touch flex-1 rounded-lg text-sm font-semibold transition ${
            aba === 'kanban' ? 'bg-brand text-brand-fg' : 'text-muted'
          }`}
        >
          Pipeline
        </button>
        <button
          role="tab"
          aria-selected={aba === 'automacoes'}
          onClick={() => setAba('automacoes')}
          className={`min-h-touch flex-1 rounded-lg text-sm font-semibold transition ${
            aba === 'automacoes' ? 'bg-brand text-brand-fg' : 'text-muted'
          }`}
        >
          Automações
        </button>
      </div>

      {clienteId &&
        (aba === 'kanban' ? (
          <Kanban clienteId={clienteId} />
        ) : (
          <Automacoes clienteId={clienteId} />
        ))}
    </section>
  );
}

// ----- Pipeline / Kanban -----

function Kanban({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', clienteId],
    queryFn: () => apiGet<PipelineComEstagios[]>(`/pipelines?cliente_id=${clienteId}`),
  });

  const criarPipeline = useMutation({
    mutationFn: () =>
      apiPost<PipelineComEstagios>('/pipelines', { cliente_id: clienteId, nome: 'Vendas' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pipelines', clienteId] }),
  });

  if (pipelinesQuery.isPending) return <Esqueleto />;
  if (pipelinesQuery.isError) {
    return (
      <div role="alert" className="card border-danger/30 text-sm text-danger">
        Não rolou carregar o pipeline. Tenta de novo.
      </div>
    );
  }

  const pipeline = pipelinesQuery.data?.[0];
  if (!pipeline) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-3xl">🚀</p>
        <p className="font-display text-lg font-extrabold">Sem pipeline ainda</p>
        <p className="text-sm text-content-2">Bora criar o funil de vendas desse cliente?</p>
        <button
          type="button"
          className="btn-brand w-full"
          onClick={() => criarPipeline.mutate()}
          disabled={criarPipeline.isPending}
        >
          {criarPipeline.isPending ? 'Criando…' : 'Criar pipeline'}
        </button>
      </div>
    );
  }

  return <QuadroKanban clienteId={clienteId} pipeline={pipeline} />;
}

function QuadroKanban({
  clienteId,
  pipeline,
}: {
  clienteId: string;
  pipeline: PipelineComEstagios;
}) {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ['leads', pipeline.id],
    queryFn: () => apiGet<LeadComEstagio[]>(`/leads?pipeline_id=${pipeline.id}`),
  });

  const invalidarLeads = () => void qc.invalidateQueries({ queryKey: ['leads', pipeline.id] });

  const estagiosOrdenados = [...pipeline.estagios].sort((a, b) => a.ordem - b.ordem);
  const leads = leadsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <button type="button" className="btn-brand w-full" onClick={() => setCriando(true)}>
        + Lead
      </button>

      {criando && (
        <FormularioLead
          clienteId={clienteId}
          estagioInicialId={estagiosOrdenados[0]?.id ?? ''}
          onFechar={() => setCriando(false)}
          onCriado={() => {
            setCriando(false);
            invalidarLeads();
          }}
        />
      )}

      {leadsQuery.isPending && <Esqueleto />}

      {!leadsQuery.isPending && (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {estagiosOrdenados.map((estagio) => (
            <Coluna
              key={estagio.id}
              estagio={estagio}
              estagios={estagiosOrdenados}
              leads={leads.filter((l) => l.estagio_id === estagio.id)}
              onMudou={invalidarLeads}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Coluna({
  estagio,
  estagios,
  leads,
  onMudou,
}: {
  estagio: Estagio;
  estagios: Estagio[];
  leads: LeadComEstagio[];
  onMudou: () => void;
}) {
  return (
    <div className="w-64 shrink-0 snap-start">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-3 w-1.5 rounded-full bg-brand" />
        <h2 className="font-display text-sm font-extrabold">{estagio.nome}</h2>
        <span className="ml-auto rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold text-muted">
          {leads.length}
        </span>
      </div>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} estagios={estagios} onMudou={onMudou} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
            Vazio
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  estagios,
  onMudou,
}: {
  lead: LeadComEstagio;
  estagios: Estagio[];
  onMudou: () => void;
}) {
  const indiceAtual = estagios.findIndex((e) => e.id === lead.estagio_id);
  const proximo = estagios[indiceAtual + 1];

  const mover = useMutation({
    mutationFn: (patch: { estagio_id?: string; status?: StatusLead }) =>
      apiPatch<LeadComEstagio>(`/leads/${lead.id}`, patch),
    onSuccess: onMudou,
  });

  return (
    <div className="card space-y-2 p-3">
      <div>
        <p className="truncate text-sm font-semibold text-content">{lead.nome}</p>
        <p className="truncate text-xs text-content-2">{lead.contato}</p>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full bg-muted/15 px-2 py-0.5 font-medium text-muted">
          {lead.origem}
        </span>
        {lead.valor !== null && (
          <span className="font-display font-bold text-content">{fmtMoeda(lead.valor)}</span>
        )}
      </div>
      {lead.status !== 'aberto' ? (
        <span
          className={`block rounded-full px-2 py-0.5 text-center text-[10px] font-bold uppercase ${
            lead.status === 'ganho' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
          }`}
        >
          {lead.status}
        </span>
      ) : (
        <div className="flex gap-1.5">
          {proximo && (
            <button
              type="button"
              className="btn-ghost flex-1 !min-h-[36px] px-2 text-xs"
              onClick={() => mover.mutate({ estagio_id: proximo.id })}
              disabled={mover.isPending}
            >
              → {proximo.nome}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost !min-h-[36px] px-2 text-xs text-success"
            onClick={() => mover.mutate({ status: 'ganho' })}
            disabled={mover.isPending}
            aria-label="Marcar como ganho"
          >
            ✓
          </button>
          <button
            type="button"
            className="btn-ghost !min-h-[36px] px-2 text-xs text-danger"
            onClick={() => mover.mutate({ status: 'perdido' })}
            disabled={mover.isPending}
            aria-label="Marcar como perdido"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function FormularioLead({
  clienteId,
  estagioInicialId,
  onFechar,
  onCriado,
}: {
  clienteId: string;
  estagioInicialId: string;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [origem, setOrigem] = useState('manual');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () =>
      apiPost('/leads', {
        cliente_id: clienteId,
        estagio_id: estagioInicialId,
        nome,
        contato,
        origem,
        valor: valor ? Number(valor.replace(',', '.')) : undefined,
      }),
    onSuccess: onCriado,
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim() || !contato.trim()) {
          setErro('Preenche nome e contato.');
          return;
        }
        criar.mutate();
      }}
    >
      <input
        className="field text-sm"
        placeholder="Nome do lead"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        aria-label="Nome do lead"
      />
      <input
        className="field text-sm"
        placeholder="E-mail, telefone ou WhatsApp"
        value={contato}
        onChange={(e) => setContato(e.target.value)}
        aria-label="Contato"
      />
      <div className="flex gap-2">
        <select
          className="field text-sm"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          aria-label="Origem"
        >
          {ORIGENS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          className="field text-sm"
          placeholder="Valor (R$)"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label="Valor estimado"
        />
      </div>
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-brand flex-1" disabled={criar.isPending}>
          {criar.isPending ? 'Criando…' : 'Criar lead'}
        </button>
        <button type="button" className="btn-ghost flex-1" onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ----- Automações -----

function Automacoes({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', clienteId],
    queryFn: () => apiGet<PipelineComEstagios[]>(`/pipelines?cliente_id=${clienteId}`),
  });
  const automacoesQuery = useQuery({
    queryKey: ['automacoes', clienteId],
    queryFn: () => apiGet<Automacao[]>(`/automacoes?cliente_id=${clienteId}`),
  });

  const invalidar = () => void qc.invalidateQueries({ queryKey: ['automacoes', clienteId] });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      apiPatch(`/automacoes/${id}`, { ativo }),
    onSuccess: invalidar,
  });

  const estagios = pipelinesQuery.data?.[0]?.estagios ?? [];
  const automacoes = automacoesQuery.data ?? [];

  return (
    <div className="space-y-3">
      <button type="button" className="btn-brand w-full" onClick={() => setCriando((v) => !v)}>
        {criando ? 'Fechar' : '+ Automação'}
      </button>

      {criando && (
        <FormularioAutomacao
          clienteId={clienteId}
          estagios={estagios}
          onCriada={() => {
            setCriando(false);
            invalidar();
          }}
        />
      )}

      {automacoesQuery.isPending && <Esqueleto />}
      {automacoes.length === 0 && !automacoesQuery.isPending && (
        <div className="card text-center text-sm text-content-2">
          Nenhuma automação ainda. Bora criar a primeira?
        </div>
      )}
      <ul className="space-y-2">
        {automacoes.map((a) => (
          <li key={a.id} className="card space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-content">{a.nome}</p>
              <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={a.ativo}
                  onChange={(e) => alternarAtivo.mutate({ id: a.id, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                />
                ativa
              </label>
            </div>
            <p className="text-xs text-content-2">
              Quando <b>{RÓTULO_GATILHO[a.gatilho]}</b>
              {a.condicoes.origem && (
                <>
                  {' '}
                  e origem = <b>{a.condicoes.origem}</b>
                </>
              )}
              {a.condicoes.estagio_nome && (
                <>
                  {' '}
                  para <b>{a.condicoes.estagio_nome}</b>
                </>
              )}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-content">
              {a.acoes.map((acao, i) => (
                <li key={i}>{descreverAcao(acao)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RÓTULO_GATILHO: Record<GatilhoAutomacao, string> = {
  lead_criado: 'o lead entra',
  lead_mudou_estagio: 'o lead muda de estágio',
};

function descreverAcao(acao: CriarAutomacao['acoes'][number]): string {
  switch (acao.tipo) {
    case 'mudar_estagio':
      return `Mover para "${acao.estagio_nome}"`;
    case 'definir_status':
      return `Marcar como ${acao.status}`;
    case 'criar_evento':
      return `Anotar: "${acao.descricao}"`;
  }
}

function FormularioAutomacao({
  clienteId,
  estagios,
  onCriada,
}: {
  clienteId: string;
  estagios: Estagio[];
  onCriada: () => void;
}) {
  const [nome, setNome] = useState('');
  const [gatilho, setGatilho] = useState<GatilhoAutomacao>('lead_criado');
  const [origem, setOrigem] = useState('');
  const [estagioCondicao, setEstagioCondicao] = useState('');
  const [tipoAcao, setTipoAcao] = useState<'mudar_estagio' | 'definir_status' | 'criar_evento'>(
    'mudar_estagio',
  );
  const [estagioDestino, setEstagioDestino] = useState(estagios[0]?.nome ?? '');
  const [statusDestino, setStatusDestino] = useState<StatusLead>('ganho');
  const [descricaoEvento, setDescricaoEvento] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () => {
      const acao: CriarAutomacao['acoes'][number] =
        tipoAcao === 'mudar_estagio'
          ? { tipo: 'mudar_estagio', estagio_nome: estagioDestino }
          : tipoAcao === 'definir_status'
            ? { tipo: 'definir_status', status: statusDestino }
            : { tipo: 'criar_evento', descricao: descricaoEvento };

      const payload: CriarAutomacao = {
        cliente_id: clienteId,
        nome,
        gatilho,
        condicoes: {
          ...(origem ? { origem } : {}),
          ...(gatilho === 'lead_mudou_estagio' && estagioCondicao
            ? { estagio_nome: estagioCondicao }
            : {}),
        },
        acoes: [acao],
      };
      return apiPost('/automacoes', payload);
    },
    onSuccess: onCriada,
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim()) {
          setErro('Dá um nome pra automação.');
          return;
        }
        if (tipoAcao === 'criar_evento' && !descricaoEvento.trim()) {
          setErro('Descreve o que anotar.');
          return;
        }
        criar.mutate();
      }}
    >
      <input
        className="field text-sm"
        placeholder="Nome da automação"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        aria-label="Nome da automação"
      />

      <label className="block text-xs font-medium text-muted">
        Quando
        <select
          className="field mt-1 text-sm"
          value={gatilho}
          onChange={(e) => setGatilho(e.target.value as GatilhoAutomacao)}
        >
          <option value="lead_criado">o lead entra</option>
          <option value="lead_mudou_estagio">o lead muda de estágio</option>
        </select>
      </label>

      <div className="flex gap-2">
        <input
          className="field text-sm"
          placeholder="Origem (opcional)"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          aria-label="Filtro de origem"
        />
        {gatilho === 'lead_mudou_estagio' && (
          <select
            className="field text-sm"
            value={estagioCondicao}
            onChange={(e) => setEstagioCondicao(e.target.value)}
            aria-label="Filtro de estágio"
          >
            <option value="">Qualquer estágio</option>
            {estagios.map((e) => (
              <option key={e.id} value={e.nome}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <label className="block text-xs font-medium text-muted">
        Então
        <select
          className="field mt-1 text-sm"
          value={tipoAcao}
          onChange={(e) => setTipoAcao(e.target.value as typeof tipoAcao)}
        >
          <option value="mudar_estagio">Mover para estágio</option>
          <option value="definir_status">Marcar status</option>
          <option value="criar_evento">Anotar na linha do tempo</option>
        </select>
      </label>

      {tipoAcao === 'mudar_estagio' && (
        <select
          className="field text-sm"
          value={estagioDestino}
          onChange={(e) => setEstagioDestino(e.target.value)}
          aria-label="Estágio de destino"
        >
          {estagios.map((e) => (
            <option key={e.id} value={e.nome}>
              {e.nome}
            </option>
          ))}
        </select>
      )}
      {tipoAcao === 'definir_status' && (
        <select
          className="field text-sm"
          value={statusDestino}
          onChange={(e) => setStatusDestino(e.target.value as StatusLead)}
          aria-label="Status de destino"
        >
          <option value="ganho">Ganho</option>
          <option value="perdido">Perdido</option>
          <option value="aberto">Aberto</option>
        </select>
      )}
      {tipoAcao === 'criar_evento' && (
        <input
          className="field text-sm"
          placeholder="O que anotar"
          value={descricaoEvento}
          onChange={(e) => setDescricaoEvento(e.target.value)}
          aria-label="Descrição do evento"
        />
      )}

      {erro && <p className="text-xs text-danger">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-brand flex-1" disabled={criar.isPending}>
          {criar.isPending ? 'Criando…' : 'Criar automação'}
        </button>
      </div>
    </form>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card h-20 animate-pulse bg-line/40" />
      ))}
    </div>
  );
}
