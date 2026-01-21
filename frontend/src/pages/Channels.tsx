import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TrendingUp, Info, Target, DollarSign, Minus } from 'lucide-react';
import { PeriodSelector, Card, LoadingState, EmptyState, MetricDisplay, InfoCard, HelpTooltip } from '../components';
import { Badge } from '../components/ui';
import { useApp } from '../context/AppContext';
import { getChannels } from '../api';
import { formatCurrency } from '../utils/formatters';
import styles from './Channels.module.css';


// Premium color palette matching new theme
const COLORS = ['#2D3FE0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function Channels() {
  const { property, dateRange } = useApp();
  const [channelData, setChannelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (property) loadChannels();
  }, [property, dateRange]);

  const loadChannels = async () => {
    if (!property) return;
    setLoading(true);
    const res = await getChannels(property.id, dateRange.days);
    if (res.success && res.data) setChannelData(res.data);
    setLoading(false);
  };

  const channels = channelData?.channels || [];
  const insights = channelData?.insights || {};

  const totalRevenue = channels.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
  const totalCommission = channels.reduce(
    (sum: number, c: any) => sum + (c.estimatedCommission || 0),
    0
  );
  const totalNights = channels.reduce((sum: number, c: any) => sum + (c.roomNights || 0), 0);
  const avgAdr = totalNights > 0 ? totalRevenue / totalNights : 0;

  const sortedByAdrNet = [...channels]
    .filter((c: any) => c.roomNights > 0)
    .sort((a: any, b: any) => b.adrNet - a.adrNet);

  const adrChartData = sortedByAdrNet.map((c: any, i: number) => ({
    name: c.source.length > 12 ? c.source.substring(0, 12) + '...' : c.source,
    fullName: c.source,
    adrNet: c.adrNet,
    commission: Math.round(c.adr * c.effectiveCommissionRate),
    fill: COLORS[i % COLORS.length],
  }));

  const pieData = channels
    .filter((c: any) => c.revenue > 0)
    .map((c: any, i: number) => ({
      name: c.source,
      value: c.revenue || 0,
      fill: COLORS[i % COLORS.length],
    }));

  const fmt = (value: number, compact: boolean = false) => formatCurrency(value, { compact });

  if (loading) {
    return <LoadingState message="Analizando canales..." />;
  }

  if (channels.length === 0) {
    return (
      <div className="channels-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Rentabilidad por Canal</h1>
            <p className="page-subtitle">Cuánto ganás realmente después de comisiones</p>
          </div>
          <PeriodSelector />
        </div>
        <EmptyState
          icon={<Target size={40} />}
          title="Sin datos de canales"
          description="Importá el Reservations Report o Channel Performance para ver este análisis."
          action={{ label: 'Importar datos', to: '/importar' }}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Rentabilidad por Canal
            <HelpTooltip termKey="channelMix" size="md" />
          </h1>
          <p className="page-subtitle">¿Cuánto te deja cada canal después de comisiones?</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Hero Channel Insight */}
      <Card variant="hero" className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroMain}>
            <div className={styles.heroIcon}>
              <Target size={32} />
            </div>
            <div className={styles.heroText}>
              <h2 className={styles.heroHeadline}>
                {insights.worstChannel
                  ? `Atención: ${insights.worstChannel.name} te está costando un ${channels.find((c: any) => c.source === insights.worstChannel.name)?.realCostPercent.toFixed(0)}% real`
                  : 'Tu mix de canales está saludable'}
              </h2>
              <p className={styles.heroSubline}>
                {insights.worstChannel?.realCost ||
                  'Seguí impulsando tus reservas directas para maximizar margen.'}
              </p>
            </div>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>Benchmark Directo</span>
              <span className={styles.heroStatValue}>{fmt(insights.directAdr || 0)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className={styles.metrics}>
        <MetricDisplay
          label="Tarifa promedio"
          value={fmt(avgAdr, true)}
          icon={<Target size={16} />}
          hint="Por noche, antes de comisiones"
        />
        <MetricDisplay
          label="Tarifa directa"
          value={fmt(insights.directAdr || 0, true)}
          icon={<DollarSign size={16} />}
          hint="Tu mejor referencia (sin comisión)"
          variant="highlight"
          valueClassName="text-success"
        />
        <MetricDisplay
          label="Total en comisiones"
          value={fmt(totalCommission, true)}
          icon={<Minus size={16} />}
          hint="Lo que pagaste a los canales"
          valueClassName="text-warning"
        />
        <MetricDisplay
          label="Ingresos netos"
          value={fmt(totalRevenue - totalCommission, true)}
          icon={<TrendingUp size={16} />}
          hint="Lo que realmente te quedó"
        />
      </div>

      {/* Charts */}
      <div className={styles.charts}>
        <Card className={styles.chartCard}>
          <h3 className={styles.chartTitle}>
            Tarifa neta por canal
            <HelpTooltip termKey="adrNet" size="sm" />
          </h3>
          <p className={styles.chartSubtitle}>Lo que te queda por noche en cada canal</p>
          <div className="channels-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={adrChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <defs>
                  <linearGradient id="gradientGreen" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="gradientRed" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    fmt(value),
                    name === 'adrNet' ? 'ADR Neto' : 'Comisión',
                  ]}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '12px 16px',
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  cursor={{ fill: 'rgba(45, 63, 224, 0.05)' }}
                />
                <Bar dataKey="adrNet" name="ADR Neto" fill="url(#gradientGreen)" radius={[0, 6, 6, 0]} />
                <Bar dataKey="commission" name="Comisión" fill="url(#gradientRed)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Distribución de Revenue</h3>
          <div className={styles.pieContainer}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '12px 16px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieLegend}>
              {pieData.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.fill }} />
                  <span className={styles.legendName}>{item.name}</span>
                  <span className={styles.legendPercent}>
                    {((item.value / totalRevenue) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card padding="none" className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3>Detalle por Canal</h3>
        </div>
        <div className={`${styles.tableWrapper} table-responsive`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Canal</th>
                <th className="text-right">Noches</th>
                <th className="text-right">Ingresos</th>
                <th className="text-right">Tarifa</th>
                <th className="text-right">Comisión</th>
                <th className="text-right">Te queda</th>
                <th className="text-right">Costo real</th>
              </tr>
            </thead>
            <tbody>
              {sortedByAdrNet.map((channel: any, index: number) => {
                const isBest = insights.bestChannel?.adrNet === channel.adrNet;
                const isWorst = insights.worstChannel?.name === channel.source;
                return (
                  <tr
                    key={index}
                    className={isBest ? styles.rowBest : isWorst ? styles.rowWorst : ''}
                  >
                    <td data-label="Canal">
                      <div className={styles.cell}>
                        <span
                          className={styles.dot}
                          style={{ background: COLORS[index % COLORS.length] }}
                        />
                        <span>{channel.source}</span>
                        {channel.isCommissionEstimated && (
                          <Badge variant="warning" size="sm">Est.</Badge>
                        )}
                      </div>
                    </td>
                    <td data-label="Noches" className="text-right">{channel.roomNights}</td>
                    <td data-label="Ingresos" className="text-right font-mono">{fmt(channel.revenue, true)}</td>
                    <td data-label="Tarifa" className="text-right font-mono">{fmt(channel.adr, true)}</td>
                    <td data-label="Comisión" className="text-right font-mono">
                      {(channel.effectiveCommissionRate * 100).toFixed(0)}%
                    </td>
                    <td data-label="Te queda" className="text-right font-mono text-success font-semibold">
                      {fmt(channel.adrNet, true)}
                    </td>
                    <td data-label="Costo real" className="text-right font-mono">
                      <span
                        className={
                          channel.realCostPercent > 20
                            ? 'text-error'
                            : channel.realCostPercent > 10
                              ? 'text-warning'
                              : 'text-success'
                        }
                      >
                        {channel.realCostPercent.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Explanation */}
      <InfoCard
        title="¿Cómo interpretar el 'Costo Real'?"
        icon={<Info size={18} />}
      >
        <p>No todos los canales con comisiones altas son malos. El <strong>Costo Real</strong> considera 
        tanto la comisión como el precio que trae cada canal:</p>
        <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.85rem' }}>
          <li>Si un canal cobra 15% pero trae precios 10% <strong>más bajos</strong> que reserva directa, tu costo real es <strong>~25%</strong>.</li>
          <li>Si un canal cobra 20% pero trae precios 10% <strong>más altos</strong> que directo, tu costo real baja a <strong>~10%</strong>.</li>
        </ul>
        <p style={{ marginTop: '0.5rem' }}>Lo que importa es cuánto dinero real te queda en el bolsillo por cada noche vendida.</p>
      </InfoCard>
    </div>
  );
}
