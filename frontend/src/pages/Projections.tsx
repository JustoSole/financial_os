import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getProjections } from '../api';
import { 
  Card, 
  PeriodSelector, 
  HelpTooltip, 
  LoadingState,
  Alert,
  Badge,
  ProgressBar
} from '../components';
import { 
  formatCurrency, 
  formatCurrencyShort, 
  formatPercent 
} from '../utils/formatters';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info, 
  DollarSign, 
  Users,
  ArrowRight,
  Clock
} from 'lucide-react';
import { ProjectionsData, PacingPeriod, GapAlert } from '@financial-os/shared';
import styles from './Projections.module.css';

export default function Projections() {
  const { property } = useApp();
  const [horizon, setHorizon] = useState(90);
  const [data, setData] = useState<ProjectionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!property?.id) return;
      setLoading(true);
      try {
        const res = await getProjections(property.id, horizon);
        if (res.success) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Error loading projections:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [property?.id, horizon]);

  if (loading) return <LoadingState message="Calculando proyecciones y ritmo de venta..." />;
  if (!data) return <div>Error al cargar proyecciones</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Proyecciones OTB</h1>
          <p className={styles.subtitle}>Radar de ingresos y ritmo de venta (On-The-Books)</p>
        </div>
        <PeriodSelector 
          value={horizon} 
          onChange={setHorizon} 
          labelPrefix="Horizonte:"
          options={[
            { value: 30, label: '30 días' },
            { value: 60, label: '60 días' },
            { value: 90, label: '90 días' },
          ]}
        />
      </header>

      {/* Nivel 1: Certeza Operativa */}
      <section className={styles.summaryGrid}>
        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <DollarSign size={20} className={styles.icon} />
            <span>Revenue Asegurado (OTB)</span>
            <HelpTooltip termKey="revenue_otb" />
          </div>
          <div className={styles.metricValue}>{formatCurrency(data.summary.revenueOTB)}</div>
          <div className={styles.metricSubtext}>
            Para los próximos {horizon} días
          </div>
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>Cobrado vs Pendiente</span>
              <span>{formatPercent((data.summary.revenueOTB - data.summary.pendingCollections) / data.summary.revenueOTB * 100)}</span>
            </div>
            <ProgressBar 
              progress={(data.summary.revenueOTB - data.summary.pendingCollections) / data.summary.revenueOTB * 100} 
              color="var(--color-success)"
            />
          </div>
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Users size={20} className={styles.icon} />
            <span>Ocupación Confirmada</span>
            <HelpTooltip termKey="occupancy_otb" />
          </div>
          <div className={styles.metricValue}>{data.summary.occupancyOTB}%</div>
          <div className={styles.pacingBadge}>
            {data.pacing.deltaVsLastYear >= 0 ? (
              <span className={styles.positive}>
                <TrendingUp size={14} /> +{data.pacing.deltaVsLastYear}% vs año ant.
              </span>
            ) : (
              <span className={styles.negative}>
                <TrendingDown size={14} /> {data.pacing.deltaVsLastYear}% vs año ant.
              </span>
            )}
          </div>
          <ProgressBar progress={data.summary.occupancyOTB} color="var(--color-primary)" />
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Clock size={20} className={styles.icon} />
            <span>Pick-up (7 días)</span>
            <HelpTooltip termKey="pickup_7d" />
          </div>
          <div className={styles.metricValue}>+{data.summary.pickupLast7Days.reservations}</div>
          <div className={styles.metricSubtext}>
            Reservas nuevas esta semana
          </div>
          <div className={styles.pickupRevenue}>
            {formatCurrency(data.summary.pickupLast7Days.revenue)} generados
          </div>
        </Card>
      </section>

      {/* Nivel 2: Gráfico de Pacing */}
      <section className={styles.pacingSection}>
        <Card title="Ritmo de Venta Semanal (Pacing YoY)">
          <div className={styles.pacingInfo}>
            <Info size={16} />
            <p>Comparación de ocupación actual vs. ocupación que tenías el año pasado a esta misma distancia del check-in (DBA).</p>
          </div>
          <div className={styles.pacingGrid}>
            {data.pacing.periods.map((period, i) => (
              <div key={i} className={styles.pacingRow}>
                <div className={styles.periodLabel}>
                  <strong>{period.label}</strong>
                  <span>{new Date(period.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className={styles.pacingBars}>
                  <div className={styles.barGroup}>
                    <div className={styles.barLabel}>Actual: {period.current.occupancy}%</div>
                    <ProgressBar progress={period.current.occupancy} color="var(--color-primary)" height={12} />
                  </div>
                  <div className={styles.barGroup}>
                    <div className={styles.barLabel}>Año Ant: {period.historical.occupancy}%</div>
                    <ProgressBar progress={period.historical.occupancy} color="var(--color-text-muted)" height={12} />
                  </div>
                </div>
                <div className={styles.periodDelta}>
                  <Badge variant={period.deltaOccupancy >= 0 ? 'success' : 'danger'}>
                    {period.deltaOccupancy >= 0 ? '+' : ''}{period.deltaOccupancy}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Nivel 3: Alertas y Gaps */}
      <section className={styles.alertsSection}>
        <div className={styles.sectionTitle}>
          <AlertTriangle size={20} />
          <h2>Baches y Oportunidades Detectadas</h2>
        </div>
        
        {data.gaps.length === 0 ? (
          <div className={styles.noGaps}>
            <TrendingUp size={40} />
            <p>No se detectaron baches críticos. Tu ritmo de venta es saludable.</p>
          </div>
        ) : (
          <div className={styles.gapsGrid}>
            {data.gaps.map(gap => (
              <Card key={gap.id} className={`${styles.gapCard} ${styles[gap.severity]}`}>
                <div className={styles.gapHeader}>
                  <Badge variant={gap.severity === 'warning' ? 'warning' : 'info'}>
                    {gap.severity.toUpperCase()}
                  </Badge>
                  <span className={styles.gapDate}>{new Date(gap.weekStart).toLocaleDateString('es-AR', { week: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                <h3>{gap.title}</h3>
                <p>{gap.description}</p>
                <div className={styles.gapStats}>
                  <div className={styles.gapStat}>
                    <span>Actual</span>
                    <strong>{gap.currentOccupancy}%</strong>
                  </div>
                  <div className={styles.gapStat}>
                    <span>Histórico</span>
                    <strong>{gap.historicalOccupancy}%</strong>
                  </div>
                </div>
                <button className={styles.actionButton}>
                  {gap.actionLabel} <ArrowRight size={16} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Cash Flow Futuro */}
      <section className={styles.cashFlowSection}>
        <Card title="Efectivo por Entrar (Próximas Semanas)">
          <div className={styles.cashFlowTable}>
            <div className={styles.tableHeader}>
              <span>Semana</span>
              <span>Esperado</span>
              <span>Ya Cobrado</span>
              <span>Pendiente</span>
            </div>
            {data.cashFlow.byWeek.map((week, i) => (
              <div key={i} className={styles.tableRow}>
                <span>{new Date(week.weekStart).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                <span>{formatCurrencyShort(week.expected)}</span>
                <span className={styles.positive}>{formatCurrencyShort(week.alreadyPaid)}</span>
                <span className={styles.warning}>{formatCurrencyShort(week.pending)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

