/** Layout mobile: cabeçalho + conteúdo rolável + bottom-nav fixo. */
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useMe } from '../hooks/useMe';
import { hexParaRgbTriplet } from '../lib/cor';
import { BottomNav } from './BottomNav';
import { Wordmark } from './Wordmark';

export function AppShell() {
  const { data: me } = useMe();
  const agencia = me?.agencia;

  // White-label básico (Sprint 10): cor da agência sobrescreve --brand globalmente.
  useEffect(() => {
    const raiz = document.documentElement;
    const triplet = agencia?.marca_cor ? hexParaRgbTriplet(agencia.marca_cor) : null;
    if (triplet) {
      raiz.style.setProperty('--brand', triplet);
    } else {
      raiz.style.removeProperty('--brand');
    }
  }, [agencia?.marca_cor]);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 px-4 pt-safe-t backdrop-blur">
        <div className="flex h-14 items-center">
          <Wordmark size="text-2xl" nome={agencia?.marca_nome} logoUrl={agencia?.marca_logo_url} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
