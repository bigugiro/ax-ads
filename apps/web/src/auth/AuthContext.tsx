/** Estado de autenticação (sessão Supabase) compartilhado via contexto. */
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setCarregando(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      carregando,
      entrar: async (email, senha) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(error.message);
      },
      sair: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, carregando],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
