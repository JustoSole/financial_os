import { ReactNode, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const buttonClasses = [
    styles.btn,
    styles[variant],
    size !== 'md' ? styles[size] : '',
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {icon && iconPosition === 'left' && !loading && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{children}</span>
      {icon && iconPosition === 'right' && !loading && <span className={styles.icon}>{icon}</span>}
    </button>
  );
}

// Link styled as button (for react-router Link)
interface ButtonLinkProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export function ButtonLinkStyles({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  className = '',
}: ButtonLinkProps) {
  const spanClasses = [
    styles.btn,
    styles[variant],
    size !== 'md' ? styles[size] : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={spanClasses}>
      {icon && iconPosition === 'left' && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{children}</span>
      {icon && iconPosition === 'right' && <span className={styles.icon}>{icon}</span>}
    </span>
  );
}


