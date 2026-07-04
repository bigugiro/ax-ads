/** Guarda de rota: exige sessão; redireciona ao login caso contrário. */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute() {
  const { session, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted" role="status">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
