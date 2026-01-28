import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import styles from './PacingChart.module.css';

interface PacingDataPoint {
  label: string;
  current: number;
  historical: number;
}

interface PacingChartProps {
  data: PacingDataPoint[];
  height?: number;
}

export default function PacingChart({ data, height = 300 }: PacingChartProps) {
  return (
    <div className={styles.container}>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Ocupación']}
              contentStyle={{ 
                background: 'var(--color-bg-card)', 
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                fontSize: '12px'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36}
              iconType="circle"
            />
            <Line 
              name="Ocupación Actual (OTB)"
              type="monotone" 
              dataKey="current" 
              stroke="var(--color-primary)" 
              strokeWidth={3}
              dot={{ r: 4, fill: "var(--color-primary)" }}
              activeDot={{ r: 6 }}
              animationDuration={1000}
            />
            <Line 
              name="Año Anterior (Misma Fecha)"
              type="monotone" 
              dataKey="historical" 
              stroke="var(--color-text-muted)" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "var(--color-text-muted)" }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

