import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getCommandCenter, getTrends } from '../api';
import { DateRangePicker, HelpTooltip, ComparisonSection, TrendChart } from '../components';
import { formatCurrency, formatCurrencyShort } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  BarChart3,
  ArrowRight,
  Upload,
  Loader2,
  Target,
  Percent,
  Building2,
  CreditCard,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  PiggyBank,
  TrendingDown as TrendDown,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
} from '../components/ui';
import styles from './Home.module.css';


// =====================================================
// Types
// =====================================================

interface ComparisonMetric {
  current: number;
  previous: number;
  changePercent: number;
}

interface ComparisonData {
  currentPeriod: string;
  previousPeriod: string;
  metrics: {
    revenue: ComparisonMetric;
    adr: ComparisonMetric;
    occupancy: ComparisonMetric;
    revpar?: ComparisonMetric;
    netProfit?: ComparisonMetric;
  };
}

interface CommandCenterData {
  period: { start: string; end: string; days: number };
  health: any;
  breakeven: any;
  unitEconomics: any;
  channels: any;
  cash: any;
  dataConfidence: any;
  comparisons: {
    mom: ComparisonData | null;
    yoy: ComparisonData | null;
  };
  weeklyAction: any;
}

// =====================================================
// Main Component - Command Center
// =====================================================

export default function Home() {
  const { property, dateRange } = useApp();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [trends, setTrends] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'adr' | 'occupancy' | 'revpar' | 'netProfit'>('revenue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!property?.id) return;
      setLoading(true);

      const startStr = dateRange.start.toISOString().substring(0, 10);
      const endStr = dateRange.end.toISOString().substring(0, 10);

      const [commandRes, trendsRes] = await Promise.all([
        getCommandCenter(property.id, startStr, endStr),
        getTrends(property.id, 6)
      ]);

      if (commandRes.success) setData(commandRes.data);
      if (trendsRes.success) setTrends(trendsRes.data);

      setLoading(false);
    }
    load();
  }, [property?.id, dateRange]);

  if (loading) {
    return (
      <div className={styles.commandCenterLoading}>
        <Loader2 className="spin" size={48} />
        <p>Analizando tu negocio...</p>
      </div>
    );
  }

  const hasData = data && data.health;

  if (!hasData) {
    return (
      <div className={styles.commandCenter}>
        <EmptyState 
          title="Importá tus datos de Cloudbeds" 
          description="Para ver tu Command Center, necesitamos los reportes de Cloudbeds. El análisis completo te dará respuestas a las 40 preguntas clave de tu negocio." 
          action={{ label: 'Comenzar importación', to: '/importar' }}
        />
      </div>
    );
  }

  return (
    <div className={styles.commandCenter}>
      {/* Header */}
      <header className={styles.commandCenterHeader}>
        <div className={styles.commandCenterTitle}>
          <h1>Panel de Control</h1>
          <span className={styles.commandCenterPeriod}>
            {dateRange.preset ? `Últimos ${dateRange.days} días` : 'Período personalizado'}
          </span>
        </div>
        <DateRangePicker />
      </header>

      {/* Data Confidence Banner */}
      <DataConfidenceBanner confidence={data.dataConfidence} />

      {/* History Coverage Banner - New */}
      {data.dataConfidence.monthsCovered <= 1 && (
        <div className={styles.historyWarningBanner}>
          <div className={styles.historyWarningIcon}>
            <Clock size={20} />
          </div>
          <div className={styles.historyWarningContent}>
            <strong>Análisis histórico limitado</strong>
            <p>Solo detectamos {data.dataConfidence.monthsCovered === 0 ? 'que no hay' : '1'} mes de datos. Importá meses anteriores para habilitar comparativas MoM y YoY.</p>
          </div>
          <Link to="/importar" className={styles.historyWarningAction}>
            Importar historia
          </Link>
        </div>
      )}

      {/* Weekly Action - THE action to take this week */}
      <WeeklyActionCard action={data.weeklyAction} />

      {/* Section 1: Business Health in 60 seconds */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<Zap size={20} />} 
          title="Salud del negocio en 60 segundos" 
          subtitle="Las respuestas que necesitás saber ahora"
        />
        
        {/* Top Alert */}
        {data.health.topAlert && (
          <TopAlert alert={data.health.topAlert} />
        )}

        {/* Hero: Net Profit */}
        <div className={styles.heroProfit}>
          <div className={styles.heroProfitLabel}>
            ¿Estoy ganando o perdiendo?
          </div>
          <div className={`${styles.heroProfitValue} ${data.health.netProfit.isPositive ? styles.positive : styles.negative}`}>
            {data.health.netProfit.isPositive ? '+' : ''}{formatCurrency(data.health.netProfit.value)}
            {data.health.netProfit.isPositive ? (
              <TrendingUp className={styles.heroProfitIcon} size={32} />
            ) : (
              <TrendingDown className={styles.heroProfitIcon} size={32} />
            )}
          </div>
          <div className={styles.heroProfitSublabel}>
            Profit neto operativo del período
            <Badge variant="warning" size="sm">Estimado</Badge>
          </div>
        </div>

        {/* Big 4 KPIs */}
        <div className={styles.kpiGrid}>
          <KPICard
            question="¿Ocupación sana?"
            helpKey="occupancy"
            value={`${data.health.kpis.occupancy.value.toFixed(0)}%`}
            benchmark={data.health.kpis.occupancy.benchmark}
            status={data.health.kpis.occupancy.status}
            icon={<Building2 size={20} />}
          />
          <KPICard
            question="¿Tarifa promedio buena?"
            helpKey="adr"
            value={formatCurrencyShort(data.health.kpis.adr.value)}
            benchmark={data.health.kpis.adr.benchmark}
            status={data.health.kpis.adr.status}
            icon={<DollarSign size={20} />}
          />
          <KPICard
            question="¿Ingreso por habitación?"
            helpKey="revpar"
            value={formatCurrencyShort(data.health.kpis.revpar.value)}
            benchmark={data.health.kpis.revpar.benchmark}
            status={data.health.kpis.revpar.status}
            icon={<BarChart3 size={20} />}
          />
          <KPICard
            question="¿Ganancia por habitación?"
            helpKey="goppar"
            value={formatCurrencyShort(data.health.kpis.goppar.value)}
            benchmark={data.health.kpis.goppar.benchmark}
            status={data.health.kpis.goppar.status}
            icon={<PiggyBank size={20} />}
          />
        </div>
      </section>

      {/* Comparisons Section */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<BarChart3 size={20} />} 
          title="Comparativas" 
          subtitle="Cómo viene tu negocio respecto a otros períodos"
        />
        
        {data.comparisons.mom && (
          <ComparisonSection
            title="vs Período Anterior (MoM)"
            periodLabel={`vs ${data.comparisons.mom.previousPeriod}`}
            metrics={[
              { 
                label: 'Revenue', 
                current: data.comparisons.mom.metrics.revenue.current, 
                previous: data.comparisons.mom.metrics.revenue.previous, 
                formatter: formatCurrencyShort 
              },
              { 
                label: 'Ocupación', 
                current: data.comparisons.mom.metrics.occupancy.current, 
                previous: data.comparisons.mom.metrics.occupancy.previous, 
                formatter: (v) => `${v.toFixed(0)}%` 
              },
              { 
                label: 'ADR', 
                current: data.comparisons.mom.metrics.adr.current, 
                previous: data.comparisons.mom.metrics.adr.previous, 
                formatter: formatCurrencyShort 
              },
              { 
                label: 'RevPAR', 
                current: data.comparisons.mom.metrics.revpar?.current || 0, 
                previous: data.comparisons.mom.metrics.revpar?.previous || 0, 
                formatter: formatCurrencyShort 
              },
            ]}
          />
        )}

        {data.comparisons.yoy ? (
          <ComparisonSection
            title="vs Año Anterior (YoY)"
            periodLabel={`vs ${data.comparisons.yoy.previousPeriod}`}
            metrics={[
              { 
                label: 'Revenue', 
                current: data.comparisons.yoy.metrics.revenue.current, 
                previous: data.comparisons.yoy.metrics.revenue.previous, 
                formatter: formatCurrencyShort 
              },
              { 
                label: 'Ocupación', 
                current: data.comparisons.yoy.metrics.occupancy.current, 
                previous: data.comparisons.yoy.metrics.occupancy.previous, 
                formatter: (v) => `${v.toFixed(0)}%` 
              },
              { 
                label: 'ADR', 
                current: data.comparisons.yoy.metrics.adr.current, 
                previous: data.comparisons.yoy.metrics.adr.previous, 
                formatter: formatCurrencyShort 
              },
            ]}
          />
        ) : (
          <div className={styles.noDataMessage}>
            <Info size={16} />
            <span>Importá datos del año pasado para ver comparativas YoY</span>
          </div>
        )}
      </section>

      {/* Trend Section */}
      {trends && (
        <section className={styles.commandSection}>
          <SectionHeader 
            icon={<TrendingUp size={20} />} 
            title="Tendencias" 
            subtitle="Evolución de los últimos 6 meses"
          />
          
          <div className={styles.trendControls}>
            <div className={styles.metricSelector}>
              <button 
                className={`${styles.metricBtn} ${selectedMetric === 'revenue' ? styles.active : ''}`}
                onClick={() => setSelectedMetric('revenue')}
              >
                Revenue
              </button>
              <button 
                className={`${styles.metricBtn} ${selectedMetric === 'occupancy' ? styles.active : ''}`}
                onClick={() => setSelectedMetric('occupancy')}
              >
                Ocupación
              </button>
              <button 
                className={`${styles.metricBtn} ${selectedMetric === 'adr' ? styles.active : ''}`}
                onClick={() => setSelectedMetric('adr')}
              >
                ADR
              </button>
              <button 
                className={`${styles.metricBtn} ${selectedMetric === 'revpar' ? styles.active : ''}`}
                onClick={() => setSelectedMetric('revpar')}
              >
                RevPAR
              </button>
              <button 
                className={`${styles.metricBtn} ${selectedMetric === 'netProfit' ? styles.active : ''}`}
                onClick={() => setSelectedMetric('netProfit')}
              >
                Profit Neto
              </button>
            </div>
          </div>

          <TrendChart
            data={trends[selectedMetric]}
            title={
              selectedMetric === 'revenue' ? 'Revenue Mensual' :
              selectedMetric === 'occupancy' ? '% Ocupación' :
              selectedMetric === 'adr' ? 'ADR (Tarifa Promedio)' :
              selectedMetric === 'revpar' ? 'RevPAR' :
              'Profit Neto Operativo'
            }
            valueFormatter={
              selectedMetric === 'occupancy' 
                ? (v) => `${v.toFixed(1)}%` 
                : formatCurrencyShort
            }
            color={
              selectedMetric === 'netProfit' 
                ? 'var(--color-success)' 
                : 'var(--color-primary)'
            }
          />
        </section>
      )}

      {/* Section 2: Punto de Equilibrio */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<Target size={20} />} 
          title="Punto de Equilibrio" 
          subtitle="¿Estoy cubriendo mis costos?"
          helpKey="breakeven"
        />
        
        <div className={styles.breakevenGrid}>
          {/* Main break-even gauge */}
          <div className={styles.breakevenMain}>
            <div className={styles.breakevenGauge}>
              <div className={styles.breakevenGaugeLabel}>Ocupación necesaria</div>
              <div className={styles.breakevenGaugeValue}>
                {data.breakeven.breakEvenOccupancy.toFixed(0)}%
              </div>
              <div className={styles.breakevenGaugeCurrent}>
                vs {data.breakeven.currentOccupancy.toFixed(0)}% actual
              </div>
              <div className={`${styles.breakevenGaugeStatus} ${
                data.breakeven.gapToBreakEven >= 0 ? styles.above : styles.below
              }`}>
                {data.breakeven.gapToBreakEven >= 0 ? (
                  <>
                    <CheckCircle2 size={16} />
                    {data.breakeven.gapToBreakEven.toFixed(0)} puntos por encima
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    {Math.abs(data.breakeven.gapToBreakEven).toFixed(0)} puntos por debajo
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Break-even metrics */}
          <div className="breakeven-metrics">
            <BreakevenMetric
              question="Noches para cubrir fijos"
              value={data.breakeven.nightsNeededForBreakEven}
              current={data.breakeven.nightsSoldThisPeriod}
              unit="noches"
              isGood={data.breakeven.nightsGap >= 0}
            />
            <BreakevenMetric
              question="Tarifa mínima (break-even)"
              value={data.breakeven.breakEvenPrice}
              current={data.breakeven.currentAdr}
              unit=""
              isGood={data.breakeven.currentAdr >= data.breakeven.breakEvenPrice}
              isCurrency
            />
            <div className="breakeven-distance">
              <div className="breakeven-distance__label">Distancia al equilibrio</div>
              <div className={`breakeven-distance__value ${data.breakeven.distanceToBreakEven.status}`}>
                {data.breakeven.distanceToBreakEven.inDollars >= 0 ? '+' : ''}
                {formatCurrency(data.breakeven.distanceToBreakEven.inDollars)}
              </div>
              <div className="breakeven-distance__nights">
                {data.breakeven.distanceToBreakEven.inNights >= 0 ? '+' : ''}
                {data.breakeven.distanceToBreakEven.inNights} noches
              </div>
            </div>
          </div>
        </div>

        {/* Margin Simulation */}
        <div className="margin-simulation">
          <div className="margin-simulation__title">
            <Info size={16} />
            Si querés un margen objetivo, ¿cuánto debés cobrar?
          </div>
          <div className="margin-simulation__options">
            <MarginOption margin={10} price={data.breakeven.marginSimulation.margin10} />
            <MarginOption margin={20} price={data.breakeven.marginSimulation.margin20} />
            <MarginOption margin={30} price={data.breakeven.marginSimulation.margin30} />
          </div>
        </div>
            </section>

          {/* Section 3: Economía por Reserva */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<DollarSign size={20} />} 
          title="Economía por Reserva" 
          subtitle="¿Cuánto gano por noche ocupada?"
          helpKey="unitEconomics"
        />
        
        <div className={styles.unitEconomicsGrid}>
          <UnitEconomicCard
            question="Ganancia por noche"
            helpKey="profitPerNight"
            value={data.unitEconomics.profitPerNight}
            isPositive={data.unitEconomics.profitPerNight >= 0}
          />
          <UnitEconomicCard
            question="Margen de contribución"
            helpKey="contributionMargin"
            value={data.unitEconomics.contributionMargin}
            subtitle={`${data.unitEconomics.contributionMarginPercent}% de la tarifa`}
            isPositive={data.unitEconomics.contributionMargin >= 0}
          />
          <UnitEconomicCard
            question="Costo por noche ocupada"
            helpKey="cpor"
            value={data.unitEconomics.cpor}
            isCost
          />
        </div>

        {/* Cost breakdown */}
        <div className="cost-breakdown">
          <div className="cost-breakdown__title">¿Qué parte es fijo vs variable?</div>
          <div className="cost-breakdown__bars">
            <CostBar label="Fijos" percent={data.unitEconomics.costMix.fixedPercent} color="var(--color-primary)" />
            <CostBar label="Variables" percent={data.unitEconomics.costMix.variablePercent} color="var(--color-warning)" />
            <CostBar label="Comisiones" percent={data.unitEconomics.costMix.commissionPercent} color="var(--color-error)" />
                </div>
          <div className="cost-breakdown__detail">
            <span>Fijo/noche: {formatCurrencyShort(data.unitEconomics.cporBreakdown.fixed)}</span>
            <span>Variable/noche: {formatCurrencyShort(data.unitEconomics.cporBreakdown.variable)}</span>
            <span>Comisión/noche: {formatCurrencyShort(data.unitEconomics.cporBreakdown.commission)}</span>
                </div>
              </div>
            </section>

      {/* Section 4: Channel Economics */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<BarChart3 size={20} />} 
          title="Canales: ¿Cuál te deja más?" 
          subtitle="¿Qué canal realmente te deja más ganancia?"
          helpKey="channelMix"
          link="/canales"
        />
        
        {/* Channel insights */}
        <div className="channel-insights">
          <ChannelInsightCard
            type="best"
            title="Mejor canal por ganancia/noche"
            channel={data.channels.bestChannelByProfitPerNight}
            value={data.channels.channels.find((c: any) => c.isTopProfitPerNight)?.profitPerNight || 0}
          />
          <ChannelInsightCard
            type="worst"
            title="Peor canal por ganancia/noche"
            channel={data.channels.worstChannelByProfitPerNight}
            value={data.channels.channels.find((c: any) => c.isWorstProfitPerNight)?.profitPerNight || 0}
          />
          <ChannelInsightCard
            type="commission"
            title="Comisión promedio que pagás"
            value={data.channels.avgEffectiveCommission}
            isPercent
          />
        </div>

        {/* OTA Dependency */}
        <div className={`ota-dependency ${data.channels.otaDependency.isOverDependent ? 'warning' : ''}`}>
          <div className="ota-dependency__header">
            {data.channels.otaDependency.isOverDependent ? (
              <AlertTriangle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span>
              Dependencia de portales: {data.channels.otaDependency.otaShare}%
              <HelpTooltip termKey="otaDependency" size="sm" />
            </span>
          </div>
          <div className="ota-dependency__bar">
            <div 
              className="ota-dependency__direct" 
              style={{ width: `${data.channels.otaDependency.directShare}%` }}
            >
              Directo {data.channels.otaDependency.directShare}%
            </div>
            <div 
              className="ota-dependency__ota" 
              style={{ width: `${data.channels.otaDependency.otaShare}%` }}
            >
              Portales {data.channels.otaDependency.otaShare}%
            </div>
          </div>
          {data.channels.otaDependency.isOverDependent && (
            <div className="ota-dependency__warning">
              Más del 70% de tus ingresos viene de portales como Booking/Airbnb. Considerá impulsar reserva directa para pagar menos comisiones.
            </div>
          )}
        </div>

        {/* Toxic Channel Alert */}
        {data.channels.toxicChannel && (
          <div className="toxic-channel">
            <AlertCircle size={20} />
            <div className="toxic-channel__content">
              <strong>Canal tóxico detectado: {data.channels.toxicChannel.name}</strong>
              <p>{data.channels.toxicChannel.reason}</p>
              <p>Pérdida potencial: {formatCurrency(data.channels.toxicChannel.potentialLoss)}</p>
            </div>
                </div>
        )}

        {/* Channel table */}
        <div className="channel-table table-responsive">
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Ingresos</th>
                <th>Noches</th>
                <th>Comisión</th>
                <th>Ganancia/Noche</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.channels.slice(0, 5).map((ch: any) => (
                <tr key={ch.name} className={ch.isTopProfitPerNight ? 'best' : ch.isWorstProfitPerNight ? 'worst' : ''}>
                  <td data-label="Canal">
                    <span className="channel-name">{ch.name}</span>
                    <span className="channel-category">{ch.category}</span>
                  </td>
                  <td data-label="Ingresos">{formatCurrencyShort(ch.revenue)}</td>
                  <td data-label="Noches">{ch.nights}</td>
                  <td data-label="Comisión">{(ch.commissionRate * 100).toFixed(0)}%</td>
                  <td data-label="Ganancia/Noche" className={ch.profitPerNight >= 0 ? 'positive' : 'negative'}>
                    {formatCurrencyShort(ch.profitPerNight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
              </div>
            </section>

      {/* Section 5: Cash & Collections - HIDDEN FOR NOW
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<CreditCard size={20} />} 
          title="Caja y Cobranzas" 
          subtitle="¿Cuánto cobré vs cuánto facturé?"
          helpKey="cashFlow"
          link="/caja"
        />
        
        {/* Reconciliation * /}
        <div className="reconciliation">
          <div className="reconciliation__item">
            <span className="reconciliation__label">Cargado</span>
            <span className="reconciliation__value">{formatCurrency(data.cash.charged)}</span>
          </div>
          <div className="reconciliation__arrow">→</div>
          <div className="reconciliation__item">
            <span className="reconciliation__label">Cobrado</span>
            <span className="reconciliation__value">{formatCurrency(data.cash.collected)}</span>
          </div>
          <div className="reconciliation__gap">
            <span className="reconciliation__label">Gap</span>
            <span className={`reconciliation__value ${data.cash.gap > 0 ? 'negative' : 'positive'}`}>
              {formatCurrency(data.cash.gap)}
            </span>
          </div>
        </div>
        <div className="reconciliation__explanation">{data.cash.gapExplanation}</div>

        {/* A/R Summary - Simple view * /}
        {data.cash.totalPending > 0 && (
          <div className="ar-summary">
            <div className="ar-summary__row">
              <span className="ar-summary__label">Por cobrar (reservas futuras)</span>
              <span className="ar-summary__value">{formatCurrency(data.cash.totalPending)}</span>
            </div>
          </div>
        )}

        {/* Cash Runway * /}
        <div className={`cash-runway cash-runway--${data.cash.runwayStatus}`}>
          <div className="cash-runway__icon">
            {data.cash.runwayStatus === 'safe' ? <CheckCircle2 size={24} /> : 
             data.cash.runwayStatus === 'warning' ? <AlertTriangle size={24} /> : 
             <AlertCircle size={24} />}
          </div>
          <div className="cash-runway__content">
            <div className="cash-runway__label">
              Días de caja disponibles
              <HelpTooltip termKey="runway" size="sm" />
            </div>
            <div className="cash-runway__value">
              {data.cash.runwayDays === 999 ? '∞ días' : `${data.cash.runwayDays} días`}
            </div>
            <div className="cash-runway__sublabel">
              {data.cash.runwayStatus === 'safe' ? 'Tu caja está saludable' :
               data.cash.runwayStatus === 'warning' ? 'Revisá tus gastos y cobros' :
               'Necesitás actuar ya'}
            </div>
          </div>
        </div>

      </section>
      */}

      {/* Quick Links */}
      <section className="quick-actions">
        <Link to="/rentabilidad" className="quick-action">
          <DollarSign size={24} />
          <span>Ver P&L por reserva</span>
          <ChevronRight size={20} />
        </Link>
        <Link to="/canales" className="quick-action">
          <BarChart3 size={24} />
          <span>Analizar canales</span>
          <ChevronRight size={20} />
        </Link>
        <Link to="/costos" className="quick-action">
          <Target size={24} />
          <span>Ajustar costos</span>
          <ChevronRight size={20} />
        </Link>
          </section>
    </div>
  );
}

// =====================================================
// Sub-Components
// =====================================================

function DataConfidenceBanner({ confidence }: { confidence: any }) {
  if (confidence.level === 'high') return null;
  
  return (
    <div className={`confidence-banner confidence-banner--${confidence.level}`}>
      <div className="confidence-banner__icon">
        {confidence.level === 'low' ? <AlertCircle size={20} /> : <HelpCircle size={20} />}
      </div>
      <div className="confidence-banner__content">
        <strong>
          Confianza de datos: {confidence.level === 'low' ? 'BAJA' : 'MEDIA'} ({confidence.score}/100)
        </strong>
        <p>
          {confidence.missingForHighConfidence.slice(0, 2).join(' • ')}
        </p>
      </div>
      <Link to={confidence.missingReports.length > 0 ? '/importar' : '/costos'} className="confidence-banner__action">
        Completar
      </Link>
    </div>
  );
}

function WeeklyActionCard({ action }: { action: any }) {
  const getIcon = () => {
    switch (action.type) {
      case 'collect_pending': return <CreditCard size={24} />;
      case 'reduce_commission': return <Percent size={24} />;
      case 'raise_adr': return <TrendingUp size={24} />;
      case 'cut_costs': return <TrendDown size={24} />;
      case 'improve_data': return <Upload size={24} />;
      default: return <Zap size={24} />;
    }
  };

  const getLink = () => {
    switch (action.type) {
      case 'collect_pending': return '/acciones';
      case 'reduce_commission': return '/canales';
      case 'raise_adr': return '/rentabilidad';
      case 'cut_costs': return '/costos';
      case 'improve_data': return '/importar';
      default: return '/acciones';
    }
  };

  return (
    <div className={`weekly-action weekly-action--priority-${action.priority}`}>
      <div className="weekly-action__icon">{getIcon()}</div>
      <div className="weekly-action__content">
        <div className="weekly-action__label">Acción de la semana</div>
        <div className="weekly-action__title">{action.title}</div>
        <div className="weekly-action__impact">{action.impact}</div>
      </div>
      <Link to={getLink()} className="weekly-action__link">
        <ArrowRight size={20} />
      </Link>
    </div>
  );
}

function TopAlert({ alert }: { alert: any }) {
  return (
    <div className={`top-alert top-alert--${alert.severity}`}>
      <AlertTriangle size={24} />
      <div className="top-alert__content">
        <strong>{alert.title}</strong>
        <p>{alert.description}</p>
      </div>
      <Link to={alert.actionLink} className="top-alert__action">
        {alert.actionLabel}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function SectionHeader({ 
  icon, 
  title, 
  subtitle,
  helpKey,
  link 
}: { 
  icon: React.ReactNode; 
  title: string; 
  subtitle: string;
  helpKey?: string;
  link?: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <div style={{ display: 'flex' }}>
        <div className={styles.sectionHeaderIcon}>{icon}</div>
        <div className={styles.sectionHeaderText}>
          <h2>
            {title}
            {helpKey && <HelpTooltip termKey={helpKey} size="md" />}
          </h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {link && (
        <Link to={link} className={styles.sectionHeaderLink}>
          Ver más <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function KPICard({ 
  question, 
  helpKey,
  value,
  benchmark, 
  status,
  icon 
}: {
  question: string;
  helpKey?: string;
  value: string;
  benchmark: string; 
  status: 'good' | 'warning' | 'bad';
  icon: React.ReactNode;
}) {
  const cardClasses = [
    styles.kpiCard,
    styles[`kpiCard${status.charAt(0).toUpperCase() + status.slice(1)}`]
  ].join(' ');

  return (
    <div className={cardClasses}>
      <div className={styles.kpiCardIcon}>{icon}</div>
      <div className={styles.kpiCardQuestion}>
        {question}
        {helpKey && <HelpTooltip termKey={helpKey} size="sm" />}
      </div>
      <div className={styles.kpiCardValue}>{value}</div>
      <div className={styles.kpiCardBenchmark}>{benchmark}</div>
    </div>
  );
}

function BreakevenMetric({ 
  question, 
  value, 
  current, 
  unit, 
  isGood, 
  isCurrency = false 
}: { 
  question: string; 
  value: number; 
  current: number; 
  unit: string;
  isGood: boolean;
  isCurrency?: boolean;
}) {
  return (
    <div className={styles.breakevenMetric}>
      <div className={styles.breakevenMetricQuestion}>{question}</div>
      <div className={styles.breakevenMetricValues}>
        <span className={styles.breakevenMetricTarget}>
          Necesario: {isCurrency ? formatCurrencyShort(value) : value} {unit}
        </span>
        <span className={`${styles.breakevenMetricCurrent} ${isGood ? styles.good : styles.bad}`}>
          Actual: {isCurrency ? formatCurrencyShort(current) : current} {unit}
          {isGood ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </span>
      </div>
    </div>
  );
}

function MarginOption({ margin, price }: { margin: number; price: number }) {
  return (
    <div className={styles.marginOption}>
      <span className={styles.marginOptionPercent}>{margin}% margen</span>
      <span className={styles.marginOptionPrice}>{formatCurrencyShort(price)}</span>
    </div>
  );
}

function UnitEconomicCard({ 
  question,
  helpKey,
  value, 
  subtitle, 
  isPositive = true,
  isCost = false 
}: { 
  question: string;
  helpKey?: string;
  value: number; 
  subtitle?: string;
  isPositive?: boolean;
  isCost?: boolean;
}) {
  const cardClasses = [
    styles.unitEconomicCard,
    isCost ? styles.cost : isPositive ? styles.positive : styles.negative
  ].join(' ');

  return (
    <div className={cardClasses}>
      <div className={styles.unitEconomicCardQuestion}>
        {question}
        {helpKey && <HelpTooltip termKey={helpKey} size="sm" />}
      </div>
      <div className={styles.unitEconomicCardValue}>
        {isCost ? '' : (isPositive ? '+' : '')}{formatCurrencyShort(value)}
        <span className={styles.unitEconomicCardUnit}>/noche</span>
      </div>
      {subtitle && <div className={styles.unitEconomicCardSubtitle}>{subtitle}</div>}
    </div>
  );
}

function CostBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className={styles.costBar}>
      <div className={styles.costBarLabel}>{label} ({percent}%)</div>
      <div className={styles.costBarTrack}>
        <div className={styles.costBarFill} style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ChannelInsightCard({ 
  type, 
  title, 
  channel, 
  value, 
  isPercent = false 
}: { 
  type: 'best' | 'worst' | 'commission'; 
  title: string; 
  channel?: string;
  value: number;
  isPercent?: boolean;
}) {
  return (
    <div className={`${styles.channelInsight} ${styles[`channelInsight--${type}`] || ''}`}>
      <div className={styles.channelInsightTitle}>{title}</div>
      {channel && <div className={styles.channelInsightChannel}>{channel}</div>}
      <div className={styles.channelInsightValue}>
        {isPercent ? `${value}%` : formatCurrencyShort(value)}
        {!isPercent && <span>/noche</span>}
      </div>
    </div>
  );
}


