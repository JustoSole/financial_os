import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import styles from './MetricDisplay.module.css';
import Badge from './Badge';

// Unified metric display component

type TrustLevel = 'real' | 'estimado' | 'incompleto';
type MetricVariant = 'default' | 'hero' | 'compact' | 'highlight' | 'danger';

interface MetricDisplayProps {
  label: string;
  value: string | number;
  variant?: MetricVariant;
  icon?: ReactNode;
  change?: number;
  previousValue?: string;
  trust?: TrustLevel;
  hint?: string;
  tooltip?: string;
  className?: string;
  valueClassName?: string;
}

export default function MetricDisplay({
  label,
  value,
  variant = 'default',
  icon,
  change,
  previousValue,
  trust,
  hint,
  tooltip,
  className = '',
  valueClassName = '',
}: MetricDisplayProps) {
  const getTrustBadge = () => {
    if (!trust) return null;
    const badges: Record<TrustLevel, { label: string; variant: 'success' | 'warning' | 'error' }> = {
      real: { label: 'Real', variant: 'success' },
      estimado: { label: 'Estimado', variant: 'warning' },
      incompleto: { label: 'Incompleto', variant: 'error' },
    };
    return badges[trust];
  };

  const getChangeIcon = () => {
    if (change === undefined || change === 0) return <Minus size={14} />;
    return change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
  };

  const getChangeClass = () => {
    if (change === undefined || change === 0) return styles.neutral;
    return change > 0 ? styles.positive : styles.negative;
  };

  const trustBadge = getTrustBadge();

  const containerClasses = [
    styles.metricDisplay,
    variant !== 'default' ? styles[variant] : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.header}>
        <span className={styles.label}>
          {icon && <span className={styles.icon}>{icon}</span>}
          {label}
          {tooltip && (
            <span className={styles.tooltip}>
              <HelpCircle size={14} />
              <span className="tooltip-content">{tooltip}</span>
            </span>
          )}
        </span>
        {trustBadge && (
          <Badge variant={trustBadge.variant} size="sm">
            {trustBadge.label}
          </Badge>
        )}
      </div>

      <div className={styles.body}>
        <span className={`${styles.value} ${valueClassName}`}>{value}</span>

        {(change !== undefined || previousValue) && (
          <div className={styles.changeRow}>
            {change !== undefined && (
              <span className={`${styles.change} ${getChangeClass()}`}>
                {getChangeIcon()}
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
            )}
            {previousValue && (
              <span className={styles.previous}>vs {previousValue}</span>
            )}
          </div>
        )}

        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
    </div>
  );
}

// Summary metric for grids
interface SummaryMetricProps {
  value: string | number;
  label: string;
  variant?: 'default' | 'positive' | 'negative' | 'highlight' | 'danger';
  className?: string;
}

export function SummaryMetric({ value, label, variant = 'default', className = '' }: SummaryMetricProps) {
  const summaryClasses = [
    styles.summaryMetric,
    variant === 'highlight' ? styles.summaryHighlight : '',
    variant === 'danger' ? styles.summaryDanger : '',
    className
  ].filter(Boolean).join(' ');

  const valueClasses = [
    styles.summaryValue,
    variant === 'positive' ? styles.valuePositive : '',
    variant === 'negative' ? styles.valueNegative : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={summaryClasses}>
      <div className={valueClasses}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  );
}


