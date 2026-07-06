/** Layout mobile: cabeçalho + conteúdo rolável + bottom-nav fixo. */
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Wordmark } from './Wordmark';

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 px-4 pt-safe-t backdrop-blur">
        <div className="flex h-14 items-center">
          <Wordmark size="text-2xl" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
