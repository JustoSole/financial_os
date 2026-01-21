import { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';
import TrendIndicator from './TrendIndicator';
import styles from './QuickStat.module.css';

interface QuickStatProps {
  label: string;
  value: number;
  format?: 'currency' | 'percent' | 'number';
  trend?: number;
  trendLabel?: string;
  icon?: ReactNode;
  tooltip?: string;
  compact?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function QuickStat({
  label,
  value,
  format = 'currency',
  trend,
  trendLabel,
  icon,
  tooltip,
  compact = false,
  variant = 'default',
}: QuickStatProps) {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return formatCurrency(value, { compact: true });
      case 'percent':
        return formatPercent(value);
      default:
        return value.toLocaleString();
    }
  };

  const containerClasses = [
    styles.quickStat,
    variant !== 'default' ? styles[variant] : '',
    compact ? styles.compact : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.header}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
        {tooltip && (
          <span className={styles.tooltip}>
            <HelpCircle size={12} />
            <span className={styles.tooltipContent}>{tooltip}</span>
          </span>
        )}
      </div>
      <div className={styles.value}>{formatValue()}</div>
      {trend !== undefined && (
        <TrendIndicator value={trend} label={trendLabel} size="sm" />
      )}
    </div>
  );
}

export default QuickStat;


