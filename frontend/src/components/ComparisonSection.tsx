import { ComparisonCard } from './ComparisonCard';
import styles from './ComparisonSection.module.css';

interface ComparisonMetric {
  label: string;
  current: number;
  previous: number;
  formatter: (v: number) => string;
  invertColors?: boolean;
}

interface ComparisonSectionProps {
  title: string;
  periodLabel: string;
  metrics: ComparisonMetric[];
}

export default function ComparisonSection({ title, periodLabel, metrics }: ComparisonSectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.grid}>
        {metrics.map((metric, index) => (
          <ComparisonCard
            key={index}
            label={metric.label}
            currentValue={metric.current}
            previousValue={metric.previous}
            formatter={metric.formatter}
            periodLabel={periodLabel}
            invertColors={metric.invertColors}
          />
        ))}
      </div>
    </div>
  );
}

