import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import styles from './ProjectionsTrendChart.module.css';

export interface ProjectionsTrendPoint {
  label: string;
  date?: string;
  actual: number;
  historico: number;
  revenueActual?: number;
  revenueHistorico?: number;
}

interface ProjectionsTrendChartProps {
  data: ProjectionsTrendPoint[];
  title?: string;
  height?: number;
  /** Ocupación mínima para ser rentable (break-even). Si existe, se dibuja una línea de referencia y el tooltip indica si se está por debajo. */
  minOccupancyForProfit?: number;
}

const COLOR_ACTUAL = 'var(--color-primary)';
const COLOR_HISTORICO = 'var(--color-text-muted)';

const COLOR_MIN_PROFIT = 'var(--color-warning, #e67700)';

export default function ProjectionsTrendChart({
  data,
  title = 'Ocupación OTB: actual vs año anterior',
  height = 300,
  minOccupancyForProfit,
}: ProjectionsTrendChartProps) {
  if (!data?.length) {
    return (
      <div className={styles.container}>
        <h4 className={styles.title}>{title}</h4>
        <div className={styles.empty}>No hay datos de pacing para el período seleccionado.</div>
      </div>
    );
  }

  const avgActual = data.reduce((s, d) => s + d.actual, 0) / data.length;
  const avgHistorico = data.reduce((s, d) => s + d.historico, 0) / data.length;
  const delta = avgActual - avgHistorico;
  const isPositive = delta >= 0;

  const chartData = data.map((d) => ({
    name: d.label,
    date: d.date,
    actual: Math.round(d.actual * 10) / 10,
    historico: Math.round(d.historico * 10) / 10,
  }));

  const isDaily = data.length > 14;
  const xInterval = isDaily ? Math.max(0, Math.floor(data.length / 12)) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h4 className={styles.title}>{title}</h4>
          <div className={styles.summary}>
            OTB actual promedio: <span className={styles.avgValue}>{avgActual.toFixed(1)}%</span>
            {' · '}
            OTB año ant.: <span className={styles.avgValue}>{avgHistorico.toFixed(1)}%</span>
            {isDaily && (
              <>
                {' · '}
                <span className={styles.avgValue}>{data.length} días</span>
              </>
            )}
          </div>
        </div>
        <div className={`${styles.trend} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} pts vs año ant.
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              dy={10}
              interval={xInterval}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                fontSize: '12px',
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                const actual = Number(p.actual);
                const historico = Number(p.historico);
                const belowMin = minOccupancyForProfit != null && actual < minOccupancyForProfit;
                const dateStr = p.date
                  ? new Date(p.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : String(label);
                return (
                  <div className={styles.tooltip}>
                    <div className={styles.tooltipLabel}>Día: {dateStr}</div>
                    <div className={styles.tooltipRow}>
                      <span>OTB actual</span>
                      <strong>{actual.toFixed(1)}%</strong>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span>OTB año anterior</span>
                      <strong>{historico.toFixed(1)}%</strong>
                    </div>
                    {minOccupancyForProfit != null && (
                      <div className={styles.tooltipRow}>
                        <span>Mín. rentable</span>
                        <strong>{minOccupancyForProfit.toFixed(1)}%</strong>
                      </div>
                    )}
                    {belowMin && (
                      <div className={styles.tooltipAlert}>Por debajo del mínimo rentable</div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => (value === 'actual' ? 'OTB actual' : 'OTB año anterior')}
              iconType="circle"
              iconSize={8}
            />
            {minOccupancyForProfit != null && Number.isFinite(minOccupancyForProfit) && (
              <ReferenceLine
                y={minOccupancyForProfit}
                stroke={COLOR_MIN_PROFIT}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: 'Mín. rentable', position: 'top', fill: COLOR_MIN_PROFIT, fontSize: 11 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="actual"
              name="actual"
              stroke={COLOR_ACTUAL}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="historico"
              name="historico"
              stroke={COLOR_HISTORICO}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
