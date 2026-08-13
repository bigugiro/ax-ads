import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

// Code-splitting por rota (Sprint 10, perf/PWA): cada página vira um chunk
// próprio — o bundle inicial carrega só o shell + a rota visitada.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const CampanhasPage = lazy(() =>
  import('./pages/CampanhasPage').then((m) => ({ default: m.CampanhasPage })),
);
const EstrategiasPage = lazy(() =>
  import('./pages/EstrategiasPage').then((m) => ({ default: m.EstrategiasPage })),
);
const CrmPage = lazy(() => import('./pages/CrmPage').then((m) => ({ default: m.CrmPage })));
const MaisPage = lazy(() => import('./pages/MaisPage').then((m) => ({ default: m.MaisPage })));
const StudioCriativoPage = lazy(() =>
  import('./pages/StudioCriativoPage').then((m) => ({ default: m.StudioCriativoPage })),
);
const PdcaPage = lazy(() => import('./pages/PdcaPage').then((m) => ({ default: m.PdcaPage })));
const AssinaturaPage = lazy(() =>
  import('./pages/AssinaturaPage').then((m) => ({ default: m.AssinaturaPage })),
);
const MarcaPage = lazy(() => import('./pages/MarcaPage').then((m) => ({ default: m.MarcaPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() =>
  import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })),
);

const queryClient = new QueryClient();

function CarregandoRota() {
  return <div className="p-4 text-sm text-muted">Carregando…</div>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<CarregandoRota />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/campanhas" element={<CampanhasPage />} />
                  <Route path="/estrategias" element={<EstrategiasPage />} />
                  <Route path="/crm" element={<CrmPage />} />
                  <Route path="/mais" element={<MaisPage />} />
                  <Route path="/mais/estudio-criativo" element={<StudioCriativoPage />} />
                  <Route path="/mais/pdca" element={<PdcaPage />} />
                  <Route path="/mais/assinatura" element={<AssinaturaPage />} />
                  <Route path="/mais/marca" element={<MarcaPage />} />
                  <Route path="/mais/admin" element={<AdminPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
