import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatPercent } from '../utils/formatters';
import styles from './TrendIndicator.module.css';

interface TrendIndicatorProps {
  value: number;
  label?: string;
  context?: string;
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean; // For metrics where down is good (costs)
}

export function TrendIndicator({
  value,
  label,
  context,
  size = 'md',
  inverted = false,
}: TrendIndicatorProps) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  
  const getIcon = () => {
    if (value > 0) return <TrendingUp size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />;
    if (value < 0) return <TrendingDown size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />;
    return <Minus size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />;
  };

  const getStatusClass = () => {
    if (isPositive) return styles.positive;
    if (isNegative) return styles.negative;
    return styles.neutral;
  };

  const containerClasses = [
    styles.trendIndicator,
    styles[size],
    getStatusClass()
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.badge}>
        {getIcon()}
        <span>{value > 0 ? '+' : ''}{formatPercent(value)}</span>
      </div>
      {label && <span className={styles.label}>{label}</span>}
      {context && <span className={styles.context}>{context}</span>}
    </div>
  );
}

export default TrendIndicator;


