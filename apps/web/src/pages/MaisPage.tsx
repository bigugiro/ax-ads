/** "Mais": conta, sessão, white-label, billing e (LGPD) exclusão de conta. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PoweredByAX } from '../components/Wordmark';
import { useAuth } from '../auth/AuthContext';
import { useMe } from '../hooks/useMe';
import { apiDelete, ApiError } from '../lib/api';

export function MaisPage() {
  const { session, sair } = useAuth();
  const { data: me } = useMe();

  return (
    <section aria-labelledby="mais-title" className="space-y-4">
      <h1 id="mais-title" className="font-display text-2xl font-extrabold">
        Mais
      </h1>

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-muted">Conectado como</p>
        <p className="mt-1 break-all font-medium" data-testid="user-email">
          {session?.user.email ?? '—'}
        </p>
      </div>

      <Link to="/mais/estudio-criativo" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-content">Studio criativo IA</p>
          <p className="text-xs text-content-2">Copy, headlines e classificação por IA</p>
        </div>
        <span className="text-muted">→</span>
      </Link>

      <Link to="/mais/pdca" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-content">PDCA / Otimização</p>
          <p className="text-xs text-content-2">Anomalias detectadas e recomendações</p>
        </div>
        <span className="text-muted">→</span>
      </Link>

      <Link to="/mais/assinatura" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-content">Assinatura</p>
          <p className="text-xs text-content-2">Plano, trocar ou cancelar</p>
        </div>
        <span className="text-muted">→</span>
      </Link>

      <Link to="/mais/marca" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-content">Marca</p>
          <p className="text-xs text-content-2">Nome, cor e logo (white-label)</p>
        </div>
        <span className="text-muted">→</span>
      </Link>

      {me?.usuario.super_admin && (
        <Link to="/mais/admin" className="card flex items-center justify-between">
          <div>
            <p className="font-semibold text-content">Admin</p>
            <p className="text-xs text-content-2">Todas as agências (operador do SaaS)</p>
          </div>
          <span className="text-muted">→</span>
        </Link>
      )}

      <button type="button" className="btn-ghost w-full" onClick={() => void sair()}>
        Sair
      </button>

      <ExcluirConta />

      <div className="pt-6 text-center">
        <PoweredByAX />
      </div>
    </section>
  );
}

/** LGPD (Sprint 10): direito ao esquecimento — apaga a agência inteira. */
function ExcluirConta() {
  const navigate = useNavigate();
  const { sair } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        className="w-full text-center text-xs font-medium text-danger"
        onClick={() => setConfirmando(true)}
      >
        Excluir conta e todos os dados
      </button>
    );
  }

  return (
    <div className="card space-y-2 border-danger/40">
      <p className="text-sm font-semibold text-danger">Excluir conta</p>
      <p className="text-xs text-content-2">
        Isso apaga a agência inteira (clientes, campanhas, leads, criativos, assinatura) e não pode
        ser desfeito. Digite <strong>EXCLUIR</strong> para confirmar.
      </p>
      <input
        className="field text-sm"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Digite EXCLUIR para confirmar"
      />
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => {
            setConfirmando(false);
            setTexto('');
            setErro(null);
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={texto !== 'EXCLUIR' || excluindo}
          onClick={() => {
            setExcluindo(true);
            setErro(null);
            apiDelete('/agencias/me')
              .then(async () => {
                await sair();
                navigate('/login', { replace: true });
              })
              .catch((e: unknown) => {
                setErro(e instanceof ApiError ? e.message : 'Não rolou. Tenta de novo.');
                setExcluindo(false);
              });
          }}
        >
          {excluindo ? 'Excluindo…' : 'Excluir definitivamente'}
        </button>
      </div>
    </div>
  );
}
