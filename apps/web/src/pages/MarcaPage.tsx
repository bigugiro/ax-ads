/** White-label básico (Sprint 10): nome, cor e logo da agência — exigido só
 *  owner no backend (`gerenciar_agencia`), com preview ao vivo. */
import type { Agencia } from '@ax-ads/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Wordmark';
import { useMe } from '../hooks/useMe';
import { apiPatch, ApiError } from '../lib/api';

export function MarcaPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#FF6A2C');
  const [logoUrl, setLogoUrl] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!me) return;
    setNome(me.agencia.marca_nome ?? '');
    setCor(me.agencia.marca_cor ?? '#FF6A2C');
    setLogoUrl(me.agencia.marca_logo_url ?? '');
  }, [me]);

  const salvar = useMutation({
    mutationFn: () =>
      apiPatch<Agencia>('/agencias/marca', {
        marca_nome: nome.trim() || null,
        marca_cor: cor,
        marca_logo_url: logoUrl.trim() || null,
      }),
    onSuccess: () => {
      setErro(null);
      setSucesso(true);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      setSucesso(false);
      setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.');
    },
  });

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div>
        <Link to="/mais" className="text-sm font-medium text-brand">
          ← Mais
        </Link>
        <h1 id="page-title" className="mt-1 font-display text-2xl font-extrabold">
          Marca
        </h1>
        <p className="text-sm text-muted">Nome, cor e logo exibidos no lugar da marca Dispara.</p>
      </div>

      <div className="card flex items-center justify-center py-6">
        <Wordmark size="text-3xl" nome={nome || undefined} logoUrl={logoUrl || undefined} />
      </div>

      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSucesso(false);
          salvar.mutate();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Nome exibido</span>
          <input
            className="field text-sm"
            placeholder="Dispara"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Cor primária</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-12 rounded-lg border border-line"
              value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : '#FF6A2C'}
              onChange={(e) => setCor(e.target.value.toUpperCase())}
              aria-label="Cor primária (seletor)"
            />
            <input
              className="field flex-1 text-sm"
              placeholder="#FF6A2C"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              aria-label="Cor primária (hex)"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">URL do logo (opcional)</span>
          <input
            className="field text-sm"
            placeholder="https://…"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </label>

        {erro && <p className="text-xs text-danger">{erro}</p>}
        {sucesso && <p className="text-xs text-success">Marca atualizada.</p>}

        <button type="submit" className="btn-brand w-full" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar marca'}
        </button>
      </form>
    </section>
  );
}
