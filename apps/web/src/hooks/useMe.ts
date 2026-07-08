/** `GET /me` (Sprint 10) — usuário + agência da sessão atual. Fonte única
 *  pro front decidir branding (marca da agência) e visibilidade de Admin. */
import type { Agencia, Usuario } from '@ax-ads/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

export interface Me {
  usuario: Usuario;
  agencia: Agencia;
}

export function useMe() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/me'),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}
