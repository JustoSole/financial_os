import { ReactNode } from 'react';
import styles from './Card.module.css';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'hero' | 'danger' | 'success' | 'warning';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  animate?: boolean;
  stagger?: number;
}

export default function Card({
  children,
  variant = 'default',
  className = '',
  onClick,
  padding = 'md',
  animate = false,
  stagger,
}: CardProps) {
  const cardClasses = [
    styles.card,
    variant !== 'default' ? styles[variant] : '',
    styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`],
    onClick ? styles.clickable : '',
    animate ? 'animate-fade-in' : '',
    stagger ? `stagger-${stagger}` : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// Card Header component
interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

// Card Title component
interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return <h3 className={`${styles.title} ${className}`}>{children}</h3>;
}

// Card Body component
interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

// Card Footer component
interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}


