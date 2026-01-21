import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './Loading';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  loading?: boolean;
  width?: string;
}

export default function Drawer({
  open,
  onClose,
  title,
  children,
  loading = false,
  width = '420px',
}: DrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.overlay}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className={styles.panel}
            style={{ width, maxWidth: '90vw' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              mass: 0.8
            }}
          >
            {title && (
              <div className={styles.header}>
                <h2 className={styles.title}>{title}</h2>
                <button className={styles.close} onClick={onClose} aria-label="Cerrar">
                  ×
                </button>
              </div>
            )}

            {loading ? (
              <div className={styles.loading}>
                <LoadingSpinner />
                <p>Cargando...</p>
              </div>
            ) : (
              <div className={styles.content}>{children}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Drawer Section for organizing content
interface DrawerSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'highlight' | 'action';
}

export function DrawerSection({ title, children, className = '', variant = 'default' }: DrawerSectionProps) {
  const sectionClasses = [
    styles.section,
    variant !== 'default' ? styles[variant] : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={sectionClasses}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      {children}
    </div>
  );
}

// Breakdown row for P&L displays
interface BreakdownRowProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'positive' | 'negative' | 'total';
  className?: string;
}

export function BreakdownRow({ label, value, variant = 'default', className = '' }: BreakdownRowProps) {
  const rowClasses = [
    styles.breakdownRow,
    variant !== 'default' ? styles[variant] : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClasses}>
      <span className={styles.breakdownLabel}>{label}</span>
      <span className={styles.breakdownValue}>{value}</span>
    </div>
  );
}

// Info grid for metadata
interface InfoGridProps {
  items: { label: string; value: string | ReactNode }[];
  columns?: number;
  className?: string;
}

export function InfoGrid({ items, columns = 2, className = '' }: InfoGridProps) {
  const gridClasses = [
    styles.infoGrid,
    styles[`cols${columns}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses}>
      {items.map((item, idx) => (
        <div key={idx} className={styles.infoGridItem}>
          <span className={styles.infoGridLabel}>{item.label}</span>
          <span className={styles.infoGridValue}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
