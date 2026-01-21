import { ReactNode } from 'react';
import Button from './Button';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: ReactNode | string;
  title: string;
  description?: string;
  action?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon = '📊',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const containerClasses = [
    styles.emptyState,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {icon && (
        <div className={styles.icon}>
          {typeof icon === 'string' ? icon : icon}
        </div>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <div className={styles.action}>
          {action.to ? (
            <Button variant="primary" onClick={() => window.location.href = action.to!}>
              {action.label}
            </Button>
          ) : (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


