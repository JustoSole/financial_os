import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import styles from './Alert.module.css';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  title?: string;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export default function Alert({
  children,
  variant = 'info',
  title,
  icon,
  dismissible = false,
  onDismiss,
  className = '',
}: AlertProps) {
  const defaultIcons: Record<AlertVariant, ReactNode> = {
    info: <Info size={18} />,
    success: <CheckCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    error: <AlertCircle size={18} />,
  };

  const alertClasses = [
    styles.alert,
    styles[variant],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={alertClasses}>
      <div className={styles.icon}>{icon || defaultIcons[variant]}</div>
      <div className={styles.content}>
        {title && <strong className={styles.title}>{title}</strong>}
        <div className={styles.message}>{children}</div>
      </div>
      {dismissible && (
        <button className={styles.dismiss} onClick={onDismiss} aria-label="Cerrar">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// Info card variant (with optional action)
interface InfoCardProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function InfoCard({ title, children, icon, action, className = '' }: InfoCardProps) {
  const infoCardClasses = [
    styles.infoCard,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={infoCardClasses}>
      {icon && <div className={styles.infoCardIcon}>{icon}</div>}
      <div className={styles.infoCardContent}>
        <strong className={styles.infoCardTitle}>{title}</strong>
        <div className={styles.infoCardBody}>{children}</div>
      </div>
      {action && <div className={styles.infoCardAction}>{action}</div>}
    </div>
  );
}


