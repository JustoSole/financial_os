import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Sidebar, MobileHeader } from './components';
import { Home, Actions, Channels, Costs, Import, Settings, Profitability } from './pages';
import styles from './App.module.css';

export default function App() {
  return (
    <AppProvider>
      <div className={styles.appLayout}>
        <MobileHeader />
        <Sidebar />
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/acciones" element={<Actions />} />
            <Route path="/canales" element={<Channels />} />
            {/* <Route path="/caja" element={<Cash />} /> */}
            <Route path="/costos" element={<Costs />} />
            <Route path="/rentabilidad" element={<Profitability />} />
            <Route path="/importar" element={<Import />} />
            <Route path="/configuracion" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </AppProvider>
  );
}

