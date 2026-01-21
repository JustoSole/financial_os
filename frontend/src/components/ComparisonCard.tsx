import { TrendingUp, TrendingDown } from 'lucide-react';
import styles from './ComparisonCard.module.css';

interface ComparisonCardProps {
  label: string;
  currentValue: number;
  previousValue: number;
  formatter: (v: number) => string;
  periodLabel: string;
  invertColors?: boolean; // true for costs (less is better)
}

export function ComparisonCard({ 
  label, 
  currentValue, 
  previousValue, 
  formatter, 
  periodLabel, 
  invertColors 
}: ComparisonCardProps) {
  const change = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = change > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  const hasChange = previousValue > 0;

  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{formatter(currentValue)}</div>
      
      {hasChange ? (
        <div className={`${styles.change} ${isGood ? styles.good : styles.bad}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{Math.abs(change).toFixed(0)}%</span>
          <span className={styles.periodLabel}>{periodLabel}</span>
        </div>
      ) : (
        <div className={styles.noData}>Sin datos previos</div>
      )}
    </div>
  );
}

