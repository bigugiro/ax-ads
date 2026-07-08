/** Studio criativo IA (Sprint 6): gera copy/headlines via Sonnet, classifica
 *  via Haiku. Acessível pela aba Mais — não é um item do bottom-nav fixo. */
import type {
  Cliente,
  ClassificacaoCriativo,
  CriativoComVariacoes,
  GeracaoIA,
} from '@ax-ads/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, ApiError, apiPost } from '../lib/api';

type Aba = 'copy' | 'headlines' | 'imagem' | 'analise';

const ROTULO_ANGULO: Record<ClassificacaoCriativo['angulo'], string> = {
  dor: 'Dor',
  desejo: 'Desejo',
  prova_social: 'Prova social',
  oferta: 'Oferta',
  curiosidade: 'Curiosidade',
};

function fmtCusto(usd: number): string {
  return `US$ ${usd.toFixed(4)}`;
}

export function StudioCriativoPage() {
  const [aba, setAba] = useState<Aba>('copy');
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
        <Link to="/mais" className="text-sm font-medium text-brand">
          ← Mais
        </Link>
        <h1 id="page-title" className="mt-1 font-display text-2xl font-extrabold">
          Studio criativo IA
        </h1>
        <p className="text-sm text-muted">Sonnet gera copy e headlines. Haiku classifica.</p>
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
        {(['copy', 'headlines', 'imagem', 'analise'] as const).map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`min-h-touch flex-1 rounded-lg text-sm font-semibold capitalize transition ${
              aba === a ? 'bg-brand text-brand-fg' : 'text-muted'
            }`}
          >
            {a === 'analise' ? 'Análise' : a === 'headlines' ? 'Headlines' : a === 'imagem' ? 'Imagem' : 'Copy'}
          </button>
        ))}
      </div>

      {clienteId && (
        <>
          {aba === 'analise' ? (
            <FormularioAnalise clienteId={clienteId} />
          ) : aba === 'imagem' ? (
            <FormularioImagem clienteId={clienteId} />
          ) : (
            <FormularioGeracao clienteId={clienteId} tipo={aba} />
          )}
          <CustoTotal clienteId={clienteId} />
          <Historico clienteId={clienteId} />
        </>
      )}
    </section>
  );
}

// ----- Geração (copy/headlines) -----

function FormularioGeracao({ clienteId, tipo }: { clienteId: string; tipo: 'copy' | 'headlines' }) {
  const qc = useQueryClient();
  const [produto, setProduto] = useState('');
  const [publico, setPublico] = useState('');
  const [tom, setTom] = useState('');
  const [oferta, setOferta] = useState('');
  const [quantidade, setQuantidade] = useState(3);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CriativoComVariacoes | null>(null);

  const gerar = useMutation({
    mutationFn: () =>
      apiPost<{ criativo: CriativoComVariacoes; custo: number }>(`/ia/${tipo}`, {
        cliente_id: clienteId,
        produto,
        publico,
        ...(tom ? { tom } : {}),
        ...(oferta ? { oferta } : {}),
        quantidade,
      }),
    onSuccess: (data) => {
      setErro(null);
      setResultado(data.criativo);
      void qc.invalidateQueries({ queryKey: ['criativos', clienteId] });
      void qc.invalidateQueries({ queryKey: ['geracoes-ia', clienteId] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <div className="space-y-3">
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!produto.trim() || !publico.trim()) {
            setErro('Preenche produto e público.');
            return;
          }
          setResultado(null);
          gerar.mutate();
        }}
      >
        <input
          className="field text-sm"
          placeholder="Produto ou loja"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          aria-label="Produto ou loja"
        />
        <input
          className="field text-sm"
          placeholder="Público-alvo"
          value={publico}
          onChange={(e) => setPublico(e.target.value)}
          aria-label="Público-alvo"
        />
        <input
          className="field text-sm"
          placeholder="Tom de voz (opcional)"
          value={tom}
          onChange={(e) => setTom(e.target.value)}
          aria-label="Tom de voz"
        />
        <input
          className="field text-sm"
          placeholder="Oferta ou gancho (opcional)"
          value={oferta}
          onChange={(e) => setOferta(e.target.value)}
          aria-label="Oferta ou gancho"
        />
        <label className="block text-xs font-medium text-muted">
          Quantidade de variações
          <select
            className="field mt-1 text-sm"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="text-xs text-danger">{erro}</p>}
        <button type="submit" className="btn-brand w-full" disabled={gerar.isPending}>
          {gerar.isPending ? 'Gerando…' : `Gerar ${tipo === 'headlines' ? 'headlines' : 'copy'}`}
        </button>
      </form>

      {resultado && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">Variações geradas</p>
          <ul className="space-y-2">
            {resultado.variacoes.map((v) => (
              <li key={v.id} className="rounded-xl bg-bg p-3 text-sm text-content">
                {v.conteudo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ----- Imagem -----

function FormularioImagem({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [produto, setProduto] = useState('');
  const [estilo, setEstilo] = useState('');
  const [quantidade, setQuantidade] = useState(2);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CriativoComVariacoes | null>(null);

  const gerar = useMutation({
    mutationFn: () =>
      apiPost<{ criativo: CriativoComVariacoes; custo: number }>('/ia/imagem', {
        cliente_id: clienteId,
        produto,
        ...(estilo ? { estilo } : {}),
        quantidade,
      }),
    onSuccess: (data) => {
      setErro(null);
      setResultado(data.criativo);
      void qc.invalidateQueries({ queryKey: ['criativos', clienteId] });
      void qc.invalidateQueries({ queryKey: ['geracoes-ia', clienteId] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
        Provider placeholder (demo) — gera um mockup determinístico, sem custo. Pluga a API real de
        imagem quando tiver a chave.
      </p>
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!produto.trim()) {
            setErro('Descreve o produto pra gerar a imagem.');
            return;
          }
          setResultado(null);
          gerar.mutate();
        }}
      >
        <input
          className="field text-sm"
          placeholder="Produto ou loja"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          aria-label="Produto ou loja"
        />
        <input
          className="field text-sm"
          placeholder="Estilo visual (opcional)"
          value={estilo}
          onChange={(e) => setEstilo(e.target.value)}
          aria-label="Estilo visual"
        />
        <label className="block text-xs font-medium text-muted">
          Quantidade de variações
          <select
            className="field mt-1 text-sm"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="text-xs text-danger">{erro}</p>}
        <button type="submit" className="btn-brand w-full" disabled={gerar.isPending}>
          {gerar.isPending ? 'Gerando…' : 'Gerar imagens'}
        </button>
      </form>

      {resultado && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">Variações geradas</p>
          <div className="grid grid-cols-2 gap-2">
            {resultado.variacoes.map((v) => (
              <img
                key={v.id}
                src={v.conteudo}
                alt="Variação de imagem gerada"
                className="aspect-square w-full rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Análise -----

function FormularioAnalise({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ClassificacaoCriativo | null>(null);

  const analisar = useMutation({
    mutationFn: () =>
      apiPost<{ classificacao: ClassificacaoCriativo; custo: number }>('/ia/analise', {
        cliente_id: clienteId,
        texto,
      }),
    onSuccess: (data) => {
      setErro(null);
      setResultado(data.classificacao);
      void qc.invalidateQueries({ queryKey: ['geracoes-ia', clienteId] });
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.'),
  });

  return (
    <div className="space-y-3">
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!texto.trim()) {
            setErro('Cola o texto do criativo pra classificar.');
            return;
          }
          setResultado(null);
          analisar.mutate();
        }}
      >
        <textarea
          className="field min-h-[100px] text-sm"
          placeholder="Cola aqui a copy ou headline que quer classificar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Texto do criativo"
        />
        {erro && <p className="text-xs text-danger">{erro}</p>}
        <button type="submit" className="btn-brand w-full" disabled={analisar.isPending}>
          {analisar.isPending ? 'Analisando…' : 'Classificar'}
        </button>
      </form>

      {resultado && (
        <div className="card space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
              {ROTULO_ANGULO[resultado.angulo]}
            </span>
            <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[11px] font-bold text-muted">
              Tom: {resultado.tom}
            </span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand">
              Força do CTA: {resultado.forca_cta}/5
            </span>
          </div>
          <p className="text-sm text-content">{resultado.sugestao}</p>
        </div>
      )}
    </div>
  );
}

// ----- Custo e histórico -----

function CustoTotal({ clienteId }: { clienteId: string }) {
  const { data } = useQuery({
    queryKey: ['geracoes-ia', clienteId],
    queryFn: () => apiGet<GeracaoIA[]>(`/clientes/${clienteId}/geracoes-ia`),
  });
  const total = (data ?? []).reduce((s, g) => s + g.custo, 0);
  return (
    <div className="card flex items-center justify-between">
      <span className="text-xs font-semibold uppercase text-muted">Custo acumulado (IA)</span>
      <span className="font-display text-lg font-extrabold text-content">{fmtCusto(total)}</span>
    </div>
  );
}

function Historico({ clienteId }: { clienteId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['criativos', clienteId],
    queryFn: () => apiGet<CriativoComVariacoes[]>(`/clientes/${clienteId}/criativos`),
  });

  if (isPending) return null;
  if (!data || data.length === 0) return null;

  return (
    <section aria-label="Histórico de criativos">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
        <span className="h-4 w-1.5 rounded-full bg-brand" />
        Histórico
      </h2>
      <ul className="space-y-2">
        {data.map((c) => (
          <li key={c.id} className="card">
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {c.tipo}
              </span>
              <span className="text-[11px] text-muted">
                {new Date(c.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {c.tipo === 'imagem' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {c.variacoes.map((v) => (
                  <img
                    key={v.id}
                    src={v.conteudo}
                    alt="Variação de imagem gerada"
                    className="aspect-square w-full rounded-lg border border-line object-cover"
                  />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {c.variacoes.map((v) => (
                  <li key={v.id} className="text-xs text-content-2">
                    {v.conteudo}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
