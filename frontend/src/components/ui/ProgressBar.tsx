import styles from './ProgressBar.module.css';

type ProgressVariant = 'primary' | 'success' | 'warning' | 'error' | 'info';

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  showLabel?: boolean;
  label?: string;
  height?: number;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  showLabel = false,
  label,
  height = 8,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const containerClasses = [
    styles.container,
    className
  ].filter(Boolean).join(' ');

  const fillClasses = [
    styles.fill,
    styles[variant]
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.bar} style={{ height }}>
        <div
          className={fillClasses}
          style={{ width: `${percentage}%` }}
        />
        {showLabel && (
          <span className={styles.label}>{label || `${percentage.toFixed(0)}%`}</span>
        )}
      </div>
    </div>
  );
}

// Visual bar chart (horizontal)
interface BarChartRowProps {
  label: string;
  value: number;
  maxValue: number;
  displayValue?: string;
  variant?: ProgressVariant;
  sublabel?: string;
  className?: string;
}

export function BarChartRow({
  label,
  value,
  maxValue,
  displayValue,
  variant = 'primary',
  sublabel,
  className = '',
}: BarChartRowProps) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  const rowClasses = [
    styles.barChartRow,
    className
  ].filter(Boolean).join(' ');

  const fillClasses = [
    styles.rowFill,
    styles[`rowFill${variant.charAt(0).toUpperCase() + variant.slice(1)}`]
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClasses}>
      <div className={styles.rowLabel}>
        <span className={styles.rowName}>{label}</span>
        {sublabel && <span className={styles.rowSublabel}>{sublabel}</span>}
      </div>
      <div className={styles.rowBar}>
        <div
          className={fillClasses}
          style={{ width: `${percentage}%` }}
        >
          {percentage > 15 && displayValue && (
            <span className={styles.barLabel}>{displayValue}</span>
          )}
        </div>
      </div>
      {displayValue && percentage <= 15 && (
        <div className={styles.rowValue}>{displayValue}</div>
      )}
    </div>
  );
}


