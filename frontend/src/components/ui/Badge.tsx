import { ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'pro';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  icon?: ReactNode;
}

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  icon,
}: BadgeProps) {
  const badgeClasses = [
    styles.badge,
    styles[variant],
    size !== 'md' ? styles[size] : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={badgeClasses}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  );
}

// Trust badge for data confidence
type TrustLevel = 'real' | 'estimado' | 'incompleto';

interface TrustBadgeProps {
  trust: TrustLevel;
  className?: string;
}

export function TrustBadge({ trust, className = '' }: TrustBadgeProps) {
  if (trust === 'estimado') return null;
  const config: Record<TrustLevel, { label: string; variant: BadgeVariant }> = {
    real: { label: '✓ Real', variant: 'success' },
    estimado: { label: '~ Estimado', variant: 'warning' },
    incompleto: { label: '? Incompleto', variant: 'error' },
  };

  const { label, variant } = config[trust];

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  );
}

// Confidence indicator
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBadge({ confidence, showLabel = false, className = '' }: ConfidenceBadgeProps) {
  const config: Record<ConfidenceLevel, { icon: string; label: string; variant: BadgeVariant }> = {
    high: { icon: '●', label: 'Alta', variant: 'success' },
    medium: { icon: '◐', label: 'Media', variant: 'warning' },
    low: { icon: '○', label: 'Baja', variant: 'error' },
  };

  const { icon, label, variant } = config[confidence];
  
  const confidenceClasses = [
    styles.confidence,
    styles[`confidence${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={confidenceClasses} title={`Confianza: ${label}`}>
      <span className={styles.icon}>{icon}</span>
      {showLabel && <span className={styles.label}>{label}</span>}
    </span>
  );
}

// Channel badge
type ChannelCategory = 'ota' | 'direct' | 'agencia' | 'other';

interface ChannelBadgeProps {
  channel: string;
  category?: ChannelCategory | string;
  className?: string;
}

export function ChannelBadge({ channel, category = 'other', className = '' }: ChannelBadgeProps) {
  const normalizedCategory = category.toLowerCase() as ChannelCategory;
  
  const channelBadgeClasses = [
    styles.channelBadge,
    styles[normalizedCategory] || styles.other,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={channelBadgeClasses}>
      {channel}
    </span>
  );
}


