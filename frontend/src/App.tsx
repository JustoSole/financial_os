import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, MobileHeader, ConfidenceHeader } from './components';
import { Home, Landing, Actions, Channels, Costs, Import, Settings, Profitability, Login, Register } from './pages';
import styles from './App.module.css';

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
            <Route path="/costos" element={<Costs />} />
            <Route path="/rentabilidad" element={<Profitability />} />
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
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/*" element={<RootRoute />} />
      </Routes>
    </AuthProvider>
  );
}
