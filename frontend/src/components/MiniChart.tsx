import { useMemo } from 'react';
import styles from './MiniChart.module.css';

interface DataPoint {
  value: number;
  label?: string;
}

interface MiniChartProps {
  data: DataPoint[];
  type?: 'line' | 'bar' | 'area';
  color?: 'primary' | 'success' | 'warning' | 'error';
  height?: number;
  showDots?: boolean;
  showLabels?: boolean;
}

export function MiniChart({
  data,
  type = 'line',
  color = 'primary',
  height = 40,
  showDots = false,
  showLabels = false,
}: MiniChartProps) {
  const { path, area, points } = useMemo(() => {
    if (data.length === 0) return { path: '', area: '', points: [], minValue: 0, maxValue: 0 };

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const width = 100;
    const padding = 2;

    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1 || 1)) * (width - padding * 2),
      y: height - padding - ((d.value - minValue) / range) * (height - padding * 2),
      value: d.value,
      label: d.label,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { path: pathD, area: areaD, points, minValue, maxValue };
  }, [data, height]);

  if (data.length === 0) {
    return <div className={`${styles.miniChart} ${styles.empty}`} style={{ height }}>Sin datos</div>;
  }

  const containerClasses = [
    styles.miniChart,
    styles[color]
  ].join(' ');

  return (
    <div className={containerClasses}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
        {type === 'area' && (
          <path d={area} className={styles.area} />
        )}
        
        {(type === 'line' || type === 'area') && (
          <path d={path} className={styles.line} fill="none" />
        )}

        {type === 'bar' && (
          <g>
            {points.map((p, i) => {
              const barWidth = 80 / data.length;
              const barHeight = height - p.y;
              return (
                <rect
                  key={i}
                  x={p.x - barWidth / 2}
                  y={p.y}
                  width={barWidth}
                  height={barHeight}
                  className={styles.bar}
                  rx={1}
                />
              );
            })}
          </g>
        )}

        {showDots && (
          <g>
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.5}
                className={styles.dot}
              />
            ))}
          </g>
        )}
      </svg>

      {showLabels && (
        <div className={styles.labels}>
          {data.map((d, i) => (
            <span key={i} className={styles.label}>{d.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MiniChart;


