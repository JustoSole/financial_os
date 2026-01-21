import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import styles from './TrendChart.module.css';

interface TrendPoint {
  month: string;
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  title: string;
  valueFormatter: (v: number) => string;
  color?: string;
  height?: number;
}

export default function TrendChart({ 
  data, 
  title, 
  valueFormatter, 
  color = '#3b82f6', // primary blue
  height = 300 
}: TrendChartProps) {
  // Calculate trend
  const values = data.map(d => d.value);
  const firstValue = values[0] || 0;
  const lastValue = values[values.length - 1] || 0;
  const trendPercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const isPositive = trendPercent >= 0;

  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h4 className={styles.title}>{title}</h4>
          <div className={styles.summary}>
            Promedio: <span className={styles.avgValue}>{valueFormatter(avg)}</span>
          </div>
        </div>
        <div className={`${styles.trend} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(trendPercent).toFixed(0)}%
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              dy={10}
            />
            <YAxis 
              hide={true} 
              domain={['dataMin - 10%', 'dataMax + 10%']}
            />
            <Tooltip 
              formatter={(value: number) => [valueFormatter(value), title]}
              contentStyle={{ 
                background: 'var(--color-bg-card)', 
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                fontSize: '12px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              fillOpacity={1} 
              fill="url(#colorTrend)" 
              strokeWidth={2}
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

