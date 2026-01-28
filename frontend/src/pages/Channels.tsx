import { useState, useEffect, useMemo } from 'react';
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
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Info, Target, DollarSign, Minus, ArrowRight, Clock, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PeriodSelector, Card, LoadingState, EmptyState, MetricDisplay, InfoCard, HelpTooltip } from '../components';
import { Badge, Button } from '../components/ui';
import { useApp } from '../context/AppContext';
import { getChannels } from '../api';
import { formatCurrency, formatCurrencyShort } from '../utils/formatters';
import styles from './Channels.module.css';

// Premium color palette matching new theme
const COLORS = ['#2D3FE0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function Channels() {
  const { property, dateRange } = useApp();
  const [channelData, setChannelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSimulation, setShowSimulation] = useState(false);
  const [selectedChannelForLeadTime, setSelectedChannelForLeadTime] = useState<string | null>(null);

  useEffect(() => {
    if (property) loadChannels();
  }, [property, dateRange]);

  const loadChannels = async () => {
    if (!property) return;
    setLoading(true);
    const res = await getChannels(property.id, dateRange.days);
    if (res.success && res.data) {
      setChannelData(res.data);
      // Set default selected channel for lead time if not set
      if (res.data.channels && res.data.channels.length > 0) {
        const topOta = res.data.channels.find((c: any) => 
          !['direct', 'walk-in', 'directo'].includes(c.source.toLowerCase())
        );
        setSelectedChannelForLeadTime(topOta?.source || res.data.channels[0].source);
      }
    }
    setLoading(false);
  };

  const channels = useMemo(() => {
    const rawChannels = channelData?.channels || [];
    if (rawChannels.length <= 6) return rawChannels;

    const sorted = [...rawChannels].sort((a, b) => b.revenue - a.revenue);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    const othersRevenue = others.reduce((sum, c) => sum + c.revenue, 0);
    const othersNights = others.reduce((sum, c) => sum + c.roomNights, 0);
    const othersCommission = others.reduce((sum, c) => sum + c.estimatedCommission, 0);
    const othersNetProfit = others.reduce((sum, c) => sum + c.netProfit, 0);
    const othersLeadTimes = others.flatMap((c: any) => Array(Math.max(1, c.roomNights)).fill(c.medianLeadTime || 0));
    
    let othersMedianLeadTime = 0;
    if (othersLeadTimes.length > 0) {
      const sorted = [...othersLeadTimes].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      othersMedianLeadTime = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return [
      ...top5,
      {
        source: 'Otros',
        sourceCategory: 'Other',
        revenue: othersRevenue,
        roomNights: othersNights,
        estimatedCommission: othersCommission,
        netProfit: othersNetProfit,
        profitPerNight: othersNights > 0 ? othersNetProfit / othersNights : 0,
        medianLeadTime: Math.round(othersMedianLeadTime * 10) / 10,
        revenueShare: othersRevenue / sorted.reduce((sum, c) => sum + c.revenue, 0),
        profitShare: othersNetProfit / sorted.reduce((sum, c) => sum + c.netProfit, 0),
        effectiveCommissionRate: othersRevenue > 0 ? othersCommission / othersRevenue : 0,
        adr: othersNights > 0 ? othersRevenue / othersNights : 0,
        adrNet: othersNights > 0 ? (othersRevenue - othersCommission) / othersNights : 0,
        realCostPercent: othersRevenue > 0 ? (othersCommission / othersRevenue) * 100 : 0,
      }
    ];
  }, [channelData]);

  const insights = channelData?.insights || {};
  const leadTimeAnalysis = insights.leadTimeAnalysis || {};

  const totalRevenue = channels.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
  const totalCommission = channels.reduce(
    (sum: number, c: any) => sum + (c.estimatedCommission || 0),
    0
  );
  const totalNights = channels.reduce((sum: number, c: any) => sum + (c.roomNights || 0), 0);
  const avgAdr = totalNights > 0 ? totalRevenue / totalNights : 0;

  const sortedByProfitPerNight = [...channels]
    .filter((c: any) => c.roomNights > 0)
    .sort((a: any, b: any) => b.profitPerNight - a.profitPerNight);

  const adrChartData = sortedByProfitPerNight.map((c: any, i: number) => ({
    name: c.source.length > 12 ? c.source.substring(0, 12) + '...' : c.source,
    fullName: c.source,
    adrNet: c.adrNet,
    profitPerNight: c.profitPerNight,
    commission: Math.round(c.adr * c.effectiveCommissionRate),
    fill: COLORS[i % COLORS.length],
  }));

  const profitPieData = useMemo(() => {
    const totalProfit = channels.reduce((sum: number, c: any) => sum + (c.netProfit > 0 ? c.netProfit : 0), 0);
    if (totalProfit === 0) return [];

    // Calculate raw percentages
    const rawData = channels
      .filter((c: any) => c.netProfit > 0)
      .map((c: any, i: number) => ({
        name: c.source,
        value: c.netProfit || 0,
        fill: COLORS[i % COLORS.length],
        percentage: (c.netProfit / totalProfit) * 100
      }));

    // Use Largest Remainder Method to ensure sum is 100% with 1 decimal
    const factor = 10;
    const targetSum = 100 * factor;
    
    const withFloored = rawData.map(item => ({
      ...item,
      floored: Math.floor(item.percentage * factor),
      remainder: (item.percentage * factor) - Math.floor(item.percentage * factor)
    }));

    let currentSum = withFloored.reduce((sum, item) => sum + item.floored, 0);
    const diff = targetSum - currentSum;

    const sortedByRemainder = [...withFloored].sort((a, b) => b.remainder - a.remainder);
    
    for (let i = 0; i < diff; i++) {
      const itemToIncrement = sortedByRemainder[i % sortedByRemainder.length];
      const originalItem = withFloored.find(item => item.name === itemToIncrement.name);
      if (originalItem) originalItem.floored += 1;
    }

    return withFloored.map(item => ({
      ...item,
      displayPercentage: item.floored / factor
    }));
  }, [channels]);

  const leadTimeChartData = useMemo(() => {
    if (!leadTimeAnalysis.globalLeadTimeProfitability) return [];
    return leadTimeAnalysis.globalLeadTimeProfitability.map((p: any) => ({
      range: p.leadTimeRange,
      profit: p.avgProfitPerNight,
      count: p.reservationCount,
    }));
  }, [leadTimeAnalysis]);

  const channelLeadTimeData = useMemo(() => {
    if (!selectedChannelForLeadTime || !leadTimeAnalysis.byChannel) return [];
    return leadTimeAnalysis.byChannel[selectedChannelForLeadTime] || [];
  }, [selectedChannelForLeadTime, leadTimeAnalysis]);

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
          description="Importá el Reservations Report para ver este análisis."
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

      {/* Opportunity Card */}
      {channelData?.savingsPotential?.value > 0 && (
        <Card className={styles.opportunityCard}>
          <div className={styles.opportunityHeader}>
            <div className={styles.opportunityIcon}>
              <Zap size={24} />
            </div>
            <h2 className={styles.opportunityTitle}>Oportunidad de Ahorro Directo</h2>
          </div>
          <div className={styles.opportunityGrid}>
            <div className={styles.opportunityItem}>
              <span className={styles.opportunityLabel}>Potencial de Ganancia Extra</span>
              <span className={styles.opportunityValue}>+{formatCurrency(channelData.savingsPotential.value)}</span>
              <p className={styles.opportunityDesc}>
                {channelData.savingsPotential.description}. Reemplazar reservas de OTAs por directas aumenta tu margen neto inmediatamente.
              </p>
            </div>
            <div className={styles.opportunityItem}>
              <span className={styles.opportunityLabel}>Acción Recomendada</span>
              <p className={styles.opportunityDesc}>
                Tus reservas de <strong>{insights.worstChannel?.name}</strong> tienen el costo real más alto ({channels.find((c: any) => c.source === insights.worstChannel?.name)?.realCostPercent.toFixed(0)}%). 
                Considera aplicar un "markup" de precio en este canal para incentivar la reserva directa.
              </p>
              <Link to="/acciones" className={styles.opportunityAction}>
                Ver Plan de Acción <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Hero Channel Insight (Old one, kept for context or can be removed) */}
      {!channelData?.savingsPotential?.value && (
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
      )}

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

      {/* Charts (REMOVED AS REQUESTED) */}

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
                <th className="text-right">Lead Time</th>
                <th className="text-right">Ingresos</th>
                <th className="text-right">Tarifa</th>
                <th className="text-right">Comisión</th>
                <th className="text-right">Profit/Noche</th>
                <th className="text-right">Costo real</th>
              </tr>
            </thead>
            <tbody>
              {sortedByProfitPerNight.map((channel: any, index: number) => {
                const isBest = insights.bestChannel?.name === channel.source;
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
                    <td data-label="Lead Time" className="text-right">
                      <span className="text-muted">{channel.medianLeadTime || channel.avgLeadTime || 0}d</span>
                    </td>
                    <td data-label="Ingresos" className="text-right font-mono">{fmt(channel.revenue, true)}</td>
                    <td data-label="Tarifa" className="text-right font-mono">{fmt(channel.adr, true)}</td>
                    <td data-label="Comisión" className="text-right font-mono">
                      {(channel.effectiveCommissionRate * 100).toFixed(0)}%
                    </td>
                    <td data-label="Profit/Noche" className="text-right font-mono text-success font-semibold">
                      {fmt(channel.profitPerNight, true)}
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
      <div className={styles.footerInfo}>
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
    </div>
  );
}
