import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';
import styles from './HeroMetric.module.css';

interface HeroMetricProps {
  title: string;
  value: number;
  format?: 'currency' | 'percent' | 'number' | 'days';
  trend?: {
    value: number;
    label: string;
    context?: string; // e.g., "pero inflación fue 12%"
  };
  status?: 'positive' | 'negative' | 'neutral' | 'warning';
  subtitle?: string;
  icon?: ReactNode;
  tooltip?: string;
  context?: string; // Additional context below the value
  compact?: boolean;
}

export function HeroMetric({
  title,
  value,
  format = 'currency',
  trend,
  status = 'neutral',
  subtitle,
  icon,
  tooltip,
  context,
  compact = false,
}: HeroMetricProps) {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return formatCurrency(value, { compact: !compact });
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'days':
        return value === 999 ? '∞' : `${Math.round(value)}`;
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp size={14} />;
    if (trend.value < 0) return <TrendingDown size={14} />;
    return <Minus size={14} />;
  };

  const getTrendClass = () => {
    if (!trend) return '';
    // For some metrics, down is good (costs, expenses)
    if (status === 'positive') return styles.trendPositive;
    if (status === 'negative') return styles.trendNegative;
    if (trend.value > 0) return styles.trendPositive;
    if (trend.value < 0) return styles.trendNegative;
    return styles.trendNeutral;
  };

  const getStatusClass = () => {
    switch (status) {
      case 'positive': return styles.positive;
      case 'negative': return styles.negative;
      case 'warning': return styles.warning;
      default: return '';
    }
  };

  const containerClasses = [
    styles.heroMetric,
    getStatusClass(),
    compact ? styles.compact : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.header}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        {tooltip && (
          <span className={styles.tooltip}>
            <HelpCircle size={14} />
            <span className={styles.tooltipContent}>{tooltip}</span>
          </span>
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.value}>{formatValue()}</span>
        {format === 'days' && value !== 999 && (
          <span className={styles.unit}>días</span>
        )}
      </div>

      {(trend || subtitle) && (
        <div className={styles.footer}>
          {trend && (
            <div className={`${styles.trend} ${getTrendClass()}`}>
              {getTrendIcon()}
              <span>{trend.value > 0 ? '+' : ''}{formatPercent(trend.value)}</span>
              <span className={styles.trendLabel}>{trend.label}</span>
            </div>
          )}
          {trend?.context && (
            <span className={styles.context}>{trend.context}</span>
          )}
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
      )}

      {context && (
        <p className={styles.contextText}>{context}</p>
      )}
    </div>
  );
}

export default HeroMetric;


