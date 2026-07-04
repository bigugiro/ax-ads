/** Bottom navigation mobile (zona do polegar, alvos ≥44px). */
import { NavLink } from 'react-router-dom';

interface Item {
  to: string;
  label: string;
  /** path do ícone (24x24). */
  d: string;
}

const ITENS: Item[] = [
  { to: '/', label: 'Dashboard', d: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm8 0h6V11h-6v9Zm0-16v5h6V4h-6Z' },
  { to: '/campanhas', label: 'Campanhas', d: 'M3 11l18-8-3 18-6-4-3 4-1-6 8-6-13 2Z' },
  {
    to: '/estrategias',
    label: 'Estratégias',
    d: 'M12 2l3 7h7l-5.5 4L18 20l-6-4-6 4 1.5-7L2 9h7l3-7Z',
  },
  {
    to: '/crm',
    label: 'CRM',
    d: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.3-8 4v3h9v-3c0-1 .4-1.9 1-2.6A13 13 0 0 0 8 13Zm8 0c-.3 0-.7 0-1 .1 1.2.9 2 2.1 2 3.9v3h7v-3c0-2.7-5.3-4-8-4Z',
  },
  { to: '/mais', label: 'Mais', d: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-20 border-t border-line bg-surface pb-safe-b"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITENS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-brand' : 'text-muted',
                ].join(' ')
              }
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={item.d} />
              </svg>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
