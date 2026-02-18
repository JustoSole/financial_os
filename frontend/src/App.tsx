import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, MobileHeader, ConfidenceHeader } from './components';
import styles from './App.module.css';

const Home = lazy(() => import('./pages/Home'));
const Landing = lazy(() => import('./pages/Landing'));
const Actions = lazy(() => import('./pages/Actions'));
const Channels = lazy(() => import('./pages/Channels'));
const Costs = lazy(() => import('./pages/Costs'));
const Import = lazy(() => import('./pages/Import'));
const Settings = lazy(() => import('./pages/Settings'));
const Profitability = lazy(() => import('./pages/Profitability'));
const Projections = lazy(() => import('./pages/Projections'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spin">⌛</div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spin">⌛</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Verificar si el email está confirmado (si Supabase está configurado para requerirlo)
  const isEmailConfirmed = user?.email_confirmed_at || user?.confirmed_at;
  if (!isEmailConfirmed && user?.app_metadata?.provider === 'email') {
    return <Navigate to="/login?error=unconfirmed_email" replace />;
  }

  return <>{children}</>;
}

function AppLayout() {
  return (
    <div className={styles.appLayout}>
      <MobileHeader />
      <Sidebar />
      <div className={styles.mainWrapper}>
        <ConfidenceHeader />
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/acciones" element={<Actions />} />
            <Route path="/canales" element={<Channels />} />
            <Route path="/rentabilidad" element={<Profitability />} />
            <Route path="/proyecciones" element={<Projections />} />
            <Route path="/costos" element={<Costs />} />
            <Route path="/importar" element={<Import />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function RootRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spin">⌛</div>
      </div>
    );
  }

  if (session) {
    return (
      <AppProvider>
        <PrivateRoute>
          <AppLayout />
        </PrivateRoute>
      </AppProvider>
    );
  }

  return <Landing />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/*" element={<RootRoute />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}
