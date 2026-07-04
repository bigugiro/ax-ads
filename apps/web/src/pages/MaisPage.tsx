/** "Mais": conta, sessão e (futuro) configurações/white-label. */
import { useAuth } from '../auth/AuthContext';

export function MaisPage() {
  const { session, sair } = useAuth();

  return (
    <section aria-labelledby="mais-title" className="space-y-4">
      <h1 id="mais-title" className="text-xl font-bold">
        Mais
      </h1>

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-muted">Conectado como</p>
        <p className="mt-1 break-all font-medium" data-testid="user-email">
          {session?.user.email ?? '—'}
        </p>
      </div>

      <button type="button" className="btn-ghost w-full" onClick={() => void sair()}>
        Sair
      </button>
    </section>
  );
}
