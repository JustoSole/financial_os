import { useState } from 'react';
import { Menu, X, Zap } from 'lucide-react';
import Drawer from './ui/Drawer';
import SidebarContent from './SidebarContent';
import styles from './MobileHeader.module.css';

export default function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={20} fill="currentColor" />
          </div>
          <span className={styles.logoTitle}>Financial OS</span>
        </div>
        
        <button 
          className={styles.menuButton} 
          onClick={toggleMenu}
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      <Drawer 
        open={isOpen} 
        onClose={() => setIsOpen(false)} 
        width="280px"
      >
        <div className={styles.drawerContent}>
          <SidebarContent onItemClick={() => setIsOpen(false)} />
        </div>
      </Drawer>
    </>
  );
}

