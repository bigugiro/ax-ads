import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CampanhasPage } from './pages/CampanhasPage';
import { CrmPage } from './pages/CrmPage';
import { DashboardPage } from './pages/DashboardPage';
import { EstrategiasPage } from './pages/EstrategiasPage';
import { LoginPage } from './pages/LoginPage';
import { MaisPage } from './pages/MaisPage';
import { StudioCriativoPage } from './pages/StudioCriativoPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/campanhas" element={<CampanhasPage />} />
                <Route path="/estrategias" element={<EstrategiasPage />} />
                <Route path="/crm" element={<CrmPage />} />
                <Route path="/mais" element={<MaisPage />} />
                <Route path="/mais/estudio-criativo" element={<StudioCriativoPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
