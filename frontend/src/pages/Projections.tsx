import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApiQuery, useInvalidate } from '../hooks/useApiQuery';
import { getProjections, getBreakEven } from '../api';
import { 
  Card, 
  PeriodSelector, 
  HelpTooltip, 
  LoadingState,
  EmptyState,
  Badge,
  ProgressBar,
  CalendarProjection,
  ProjectionsTrendChart
} from '../components';
import { 
  formatCurrency, 
  formatCurrencyShort, 
  formatPercent 
} from '../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info, 
  DollarSign, 
  Users,
  ArrowRight,
  Clock
} from 'lucide-react';
import type { ProjectionsData, GapAlert } from '@financial-os/shared';
import styles from './Projections.module.css';
import { CardHeader, CardTitle } from '../components/ui/Card';

const GAP_ACTION_PATH: Record<GapAlert['actionType'], string> = {
  price_adjustment: '/rentabilidad#regla-precio',
  visibility_boost: '/canales#oportunidades',
  minimum_stay: '/rentabilidad#regla-los',
  promotion: '/rentabilidad#regla-promo',
};

export default function Projections() {
  const { property, dateRange } = useApp();
  const invalidate = useInvalidate();
  const horizon = dateRange.preset ?? dateRange.days;
  const enabled = !!property?.id;

  const { data, isLoading: loading, error: loadErrorObj } = useApiQuery<ProjectionsData>(
    ['projections', property?.id, horizon],
    () => getProjections(property!.id, horizon),
    { enabled }
  );

  const { data: breakEven } = useApiQuery<{ breakEvenOccupancy?: number }>(
    ['breakeven', property?.id, '30d'],
    () => getBreakEven(property!.id, 30),
    { enabled }
  );

  const loadError = loadErrorObj?.message ?? null;

  if (loading) return <LoadingState message="Calculando proyecciones y ritmo de venta..." />;

  if (loadError) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Proyecciones OTB</h1>
            <p className={styles.subtitle}>Radar de ingresos y ritmo de venta (On-The-Books)</p>
          </div>
        </header>
        <EmptyState
          icon={<DollarSign size={48} />}
          title="No se pudieron cargar las proyecciones"
          description={loadError}
          action={{
            label: 'Reintentar',
            onClick: () => invalidate(['projections', property?.id]),
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Proyecciones OTB</h1>
            <p className={styles.subtitle}>Radar de ingresos y ritmo de venta (On-The-Books)</p>
          </div>
        </header>
        <EmptyState
          icon={<DollarSign size={48} />}
          title="Sin datos de proyecciones"
          description="Importá reservas y transacciones para ver proyecciones OTB y ritmo de venta."
          action={{ label: 'Ir a Importar', to: '/importar' }}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Proyecciones OTB</h1>
          <p className={styles.subtitle}>Radar de ingresos y ritmo de venta (On-The-Books)</p>
        </div>
        <PeriodSelector labelPrefix="Próximos" />
      </header>

      {/* Nivel 1: Certeza Operativa (KPIs) */}
      <section className={styles.summaryGrid}>
        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <DollarSign size={20} className={styles.icon} />
            <span>Revenue Asegurado (OTB)</span>
            <HelpTooltip termKey="totalOTB" />
          </div>
          <div className={styles.metricValue}>{formatCurrency(data.summary.revenueOTB)}</div>
          <div className={styles.metricSubtext}>
            Para los próximos {horizon} días
          </div>
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>Cobrado vs Pendiente</span>
              <span>{formatPercent(data.summary.collectedPercent)}</span>
            </div>
            <ProgressBar 
              value={data.summary.collectedPercent} 
              variant="success"
            />
          </div>
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Users size={20} className={styles.icon} />
            <span>Ocupación Confirmada</span>
            <HelpTooltip termKey="projectedOccupancy" />
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
          <ProgressBar value={data.summary.occupancyOTB} variant="primary" />
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Clock size={20} className={styles.icon} />
            <span>Pick-up (7 días)</span>
            <HelpTooltip termKey="pickup" />
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

      {/* Gráfico diario: Ocupación OTB actual vs OTB histórico (debajo de KPIs) */}
      <section className={styles.chartSection}>
        <ProjectionsTrendChart
          data={(() => {
            const future = data.daily.filter((d) => !d.isPast);
            const periods = data.pacing.periods;
            return future.map((d) => {
              const dateStr = d.date;
              const period = periods.find(
                (p) => dateStr >= p.startDate && dateStr < p.endDate
              );
              return {
                label: new Date(dateStr).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'short',
                }),
                date: dateStr,
                actual: d.occupancy ?? 0,
                historico: period?.historical?.occupancy ?? 0,
              };
            });
          })()}
          title="Ocupación OTB: actual vs año anterior (por día)"
          height={320}
          minOccupancyForProfit={breakEven?.breakEvenOccupancy}
        />
      </section>

      {/* Vista diaria (calendario) */}
      <section className={styles.pacingSection}>
        <Card>
          <CardHeader>
            <CardTitle>Vista Diaria de Proyecciones</CardTitle>
          </CardHeader>
          <div className={styles.pacingInfo}>
            <Info size={16} />
            <p>Revenue y ocupación estimada día por día para los próximos {horizon} días.</p>
          </div>
          <CalendarProjection data={data.daily} />
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
                  <span className={styles.gapDate}>{new Date(gap.weekStart).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
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
                <Link to={GAP_ACTION_PATH[gap.actionType]} className={styles.actionButton}>
                  {gap.actionLabel} <ArrowRight size={16} />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Cash Flow Futuro */}
      <section className={styles.cashFlowSection}>
        <Card>
          <CardHeader>
            <CardTitle>Efectivo por Entrar (Próximas Semanas) <HelpTooltip termKey="cashFlow" size="sm" /></CardTitle>
          </CardHeader>
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

