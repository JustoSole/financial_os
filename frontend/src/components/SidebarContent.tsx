import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Zap,
  Target,
  Calculator,
  Upload,
  Settings,
  HelpCircle,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import GlossaryDrawer from './GlossaryDrawer';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/acciones', icon: Zap, label: 'Acciones' },
  { to: '/canales', icon: Target, label: 'Canales' },
  { to: '/rentabilidad', icon: TrendingUp, label: 'Rentabilidad' },
  // { to: '/caja', icon: Wallet, label: 'Caja' },
  { to: '/costos', icon: Calculator, label: 'Costos' },
  { to: '/importar', icon: Upload, label: 'Importar' },
];

interface SidebarContentProps {
  onItemClick?: () => void;
}

export default function SidebarContent({ onItemClick }: SidebarContentProps) {
  const { property, actions } = useApp();
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Count pending high priority actions
  const urgentActions =
    actions?.filter((a) => a.type === 'cash_risk' || a.type === 'collections').length || 0;

  const handleNavClick = () => {
    if (onItemClick) onItemClick();
  };

  return (
    <div className={styles.sidebarInner}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Zap size={24} fill="currentColor" />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Financial OS</span>
          <span className={styles.logoSubtitle}>by Cloudbeds</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            onClick={handleNavClick}
          >
            <Icon size={20} className={styles.navIcon} />
            <span className={styles.navLabel}>{label}</span>
            {to === '/acciones' && urgentActions > 0 && (
              <span className={styles.navBadge}>{urgentActions}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Property info */}
      {property && (
        <div className={styles.property}>
          <div className={styles.propertyAvatar}>{property.name?.charAt(0) || 'H'}</div>
          <div className={styles.propertyDetails}>
            <span className={styles.propertyName}>{property.name}</span>
            <span className={`${styles.propertyPlan} sidebar__property-plan--${property.plan}`}>
              {property.plan.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <button 
          className={`${styles.navItem} ${styles.footerItem} ${styles.glossaryBtn}`}
          onClick={() => {
            setGlossaryOpen(true);
            // Don't close sidebar drawer when opening glossary
          }}
        >
          <BookOpen size={18} />
          <span>Glosario</span>
          <span className={styles.newBadge}>Nuevo</span>
        </button>
        <NavLink to="/configuracion" className={`${styles.navItem} ${styles.footerItem}`} onClick={handleNavClick}>
          <Settings size={18} />
          <span>Configuración</span>
        </NavLink>
        <a
          href="https://myfrontdesk.cloudbeds.com/hc"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.navItem} ${styles.footerItem}`}
        >
          <HelpCircle size={18} />
          <span>Ayuda</span>
        </a>
      </div>

      {/* Glossary Drawer */}
      <GlossaryDrawer isOpen={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}

