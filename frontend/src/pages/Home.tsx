import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getCommandCenter } from '../api';
import { PeriodSelector, HelpTooltip, OnboardingWizard } from '../components';
import { formatCurrency, formatCurrencyShort } from '../utils/formatters';
import { isOnboardingCompleted, markOnboardingCompleted, resetOnboarding } from '../utils/onboarding';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  BarChart3,
  ArrowRight,
  Target,
  CreditCard,
  Zap,
  ChevronRight,
  Clock,
} from 'lucide-react';
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

interface ProjectionMetrics {
  projectedRevenue: number;
  projectedOccupancy: number;
  avgBookingWindow: number;
  totalOTB: number;
  estimatedMonthEnd: number;
}

interface HomeMetricsData {
  period: { start: string; end: string; days: number };
  cobrado: { value: number; trust: string };
  cargado: { value: number; trust: string };
  pendiente: { value: number; trust: string };
  projections?: ProjectionMetrics;
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
  homeMetrics?: HomeMetricsData;
}

// =====================================================
// Main Component - Command Center
// =====================================================

export default function Home() {
  const { property, dateRange, refreshData, refreshProperty } = useApp();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check URL for forced onboarding (useful for demos)
  const urlParams = new URLSearchParams(window.location.search);
  const forceOnboarding = urlParams.get('setup') === '1';
  const resetOnboardingFlag = urlParams.get('reset_onboarding') === '1';
  
  // Initialize showOnboarding based on URL params and persistent state
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (forceOnboarding) return true;
    if (property?.id && isOnboardingCompleted(property.id)) return false;
    return true; // Default to showing onboarding until we check data
  });

  // Handle reset onboarding URL param (for testing/demo)
  useEffect(() => {
    if (resetOnboardingFlag && property?.id) {
      resetOnboarding(property.id);
      // Remove the query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('reset_onboarding');
      window.history.replaceState({}, '', url.toString());
      setShowOnboarding(true);
    }
  }, [resetOnboardingFlag, property?.id]);

  useEffect(() => {
    async function load() {
      if (!property?.id) return;
      setLoading(true);

      const startStr = dateRange.start.toISOString().substring(0, 10);
      const endStr = dateRange.end.toISOString().substring(0, 10);

      try {
        const [commandRes] = await Promise.all([
          getCommandCenter(property.id, startStr, endStr),
        ]);

        if (commandRes.success) {
          setData(commandRes.data);
          
          // Determine if we should show onboarding
          // Priority: 1) URL force, 2) Already completed (persisted), 3) Check data
          if (forceOnboarding) {
            setShowOnboarding(true);
          } else if (property?.id && isOnboardingCompleted(property.id)) {
            // CRITICAL FIX: If onboarding is marked as completed in localStorage, 
            // NEVER show it again, regardless of what the data says.
            setShowOnboarding(false);
          } else {
            // First time - check if there's real data
            // We check for both health KPIs and data confidence to be more robust
            const hasRealData = commandRes.data?.health && 
              (commandRes.data?.health?.kpis?.occupancy?.value > 0 || 
               (commandRes.data?.dataConfidence?.monthsCovered && commandRes.data?.dataConfidence?.monthsCovered > 0));
            
            setShowOnboarding(!hasRealData);
            
            // If there's real data, mark onboarding as implicitly completed
            // (they might have imported data through other means)
            if (hasRealData && property?.id) {
              markOnboardingCompleted(property.id);
            }
          }
        } else {
          // API error - only show onboarding if not completed before
          if (property?.id && !isOnboardingCompleted(property.id)) {
            setShowOnboarding(true);
          } else {
            setShowOnboarding(false);
          }
        }
      } catch (err) {
        console.error('Error loading command center:', err);
        if (property?.id && !isOnboardingCompleted(property.id)) {
          setShowOnboarding(true);
        }
      }

      setLoading(false);
    }
    load();
  }, [property?.id, dateRange, forceOnboarding]);

  const handleOnboardingComplete = async () => {
    // Mark onboarding as completed in persistent storage
    if (property?.id) {
      markOnboardingCompleted(property.id);
    }
    
    // Set loading to true while we refresh everything
    setLoading(true);
    setShowOnboarding(false);
    
    try {
      await refreshProperty();
      await refreshData();
      
      // Reload data
      if (property?.id) {
        const startStr = dateRange.start.toISOString().substring(0, 10);
        const endStr = dateRange.end.toISOString().substring(0, 10);
        const commandRes = await getCommandCenter(property.id, startStr, endStr);
        if (commandRes.success) setData(commandRes.data);
      }
    } catch (error) {
      console.error('Error refreshing after onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.commandCenter}>
        <header className={styles.commandCenterHeader}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonPeriod} />
        </header>
        
        <div className={styles.skeletonHero} />
        
        <div className={styles.quickIndicators}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
        
        <div className={styles.skeletonSummary} />
        
        <div className={styles.skeletonSection} />
      </div>
    );
  }

  const hasData = data && data.health;
  const dataConfidence = data?.dataConfidence;

  if (!hasData || showOnboarding) {
    return (
      <div className={styles.onboardingOverlay}>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
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
        <PeriodSelector />
      </header>

      {/* Data Confidence Banner */}
      <DataConfidenceBanner 
        confidence={dataConfidence} 
        onAction={() => window.location.href = '/importar'} 
      />

      {/* Demo Mode Banner - Removed */}

      {/* Costs Not Configured Banner */}
      <CostsNotConfiguredBanner unitEconomics={data.unitEconomics} />

      {/* History Coverage Banner - New */}
      {dataConfidence?.monthsCovered !== undefined && dataConfidence.monthsCovered <= 1 && (
        <div className={styles.historyWarningBanner}>
          <div className={styles.historyWarningIcon}>
            <Clock size={20} />
          </div>
          <div className={styles.historyWarningContent}>
            <strong>Análisis histórico limitado</strong>
            <p>Solo detectamos {dataConfidence.monthsCovered === 0 ? 'que no hay' : '1'} mes de datos. Importá meses anteriores para habilitar comparativas históricas.</p>
          </div>
          <button 
            onClick={() => window.location.href = '/importar'} 
            className={styles.historyWarningAction}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}
          >
            Importar historia
          </button>
        </div>
      )}

      {/* Section 1: Business Health in 60 seconds */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<Zap size={20} />} 
          title="Estado Actual" 
          subtitle="Lo que necesitás saber para decidir hoy"
        />
        
        {/* Projections Mirror Section - New */}
        {data.homeMetrics?.projections && (
          <div className={styles.projectionsGrid}>
            <div className={styles.projectionCard}>
              <div className={styles.projectionHeader}>
                <Clock size={16} />
                <span>Próximos {data.period.days} días (Proyección)</span>
              </div>
              <div className={styles.projectionMain}>
                <div className={styles.projectionItem}>
                  <span className={styles.projectionLabel}>Ingresos Proyectados</span>
                  <span className={styles.projectionValue}>{formatCurrencyShort(data.homeMetrics.projections.projectedRevenue)}</span>
                </div>
                <div className={styles.projectionItem}>
                  <span className={styles.projectionLabel}>Ocupación Proyectada</span>
                  <span className={styles.projectionValue}>{Math.round(data.homeMetrics.projections.projectedOccupancy * 100)}%</span>
                </div>
              </div>
              <div className={styles.projectionFooter}>
                <span>Estimado Cierre de Mes: <strong>{formatCurrencyShort(data.homeMetrics.projections.estimatedMonthEnd)}</strong></span>
              </div>
            </div>

            <div className={styles.projectionHighlights}>
              <div className={styles.highlightMini}>
                <span className={styles.highlightMiniLabel}>Anticipación (Booking Window)</span>
                <span className={styles.highlightMiniValue}>{data.homeMetrics.projections.avgBookingWindow} días</span>
              </div>
              <div className={styles.highlightMini}>
                <span className={styles.highlightMiniLabel}>Total On-the-Books (OTB)</span>
                <span className={styles.highlightMiniValue}>{formatCurrencyShort(data.homeMetrics.projections.totalOTB)}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Top Alert */}
        {data.health.topAlert && (
          <TopAlert alert={data.health.topAlert} />
        )}

        {/* Hero: Net Profit */}
        <div className={styles.heroProfit}>
          <div className={styles.heroProfitContent}>
            <div className={styles.heroProfitMain}>
          <div className={styles.heroProfitLabel}>
                ¿Ganancia Neta del período?
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
                Profit neto operativo
          </div>
        </div>

            {/* Context context context */}
            <div className={styles.heroProfitContext}>
              <PeriodComparisonWidget comparisons={data.comparisons} />
              <div className={styles.contextItem}>
                <span className={styles.contextLabel}>Punto de equilibrio</span>
                <div className={`${styles.contextValue} ${data.breakeven.gapToBreakEven >= 0 ? styles.positive : styles.negative}`}>
                  {data.breakeven.gapToBreakEven >= 0 ? 'CUBIERTO' : 'EN RIESGO'}
              </div>
              <span className={styles.contextSubtext}>
                {data.breakeven.gapToBreakEven >= 0 
                  ? `+${data.breakeven.nightsGap} noches de margen`
                  : `Faltan ${Math.abs(data.breakeven.nightsGap)} noches`}
              </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Decision Indicators */}
        <div className={styles.quickIndicators}>
          <StatusCard
            title="Ocupación"
            value={`${data.health.kpis.occupancy.value.toFixed(0)}%`}
            status={data.health.kpis.occupancy.status}
            label={data.health.kpis.occupancy.status === 'good' ? 'Nivel saludable' : data.health.kpis.occupancy.status === 'warning' ? 'Podría mejorar' : 'Muy baja'}
            subtitle="de habitaciones vendidas"
            helpKey="occupancy"
            comparison={data.comparisons.mom?.metrics.occupancy ? {
              value: data.comparisons.mom.metrics.occupancy.changePercent,
              label: 'vs anterior'
            } : null}
          />
          <StatusCard
            title="Ganancia por Noche"
            value={formatCurrencyShort(data.unitEconomics.profitPerNight)}
            status={data.unitEconomics.profitPerNight > 0 ? 'good' : 'bad'}
            label={data.unitEconomics.profitPerNight > 0 ? 'Rentable' : 'Con pérdida'}
            subtitle="después de costos"
            helpKey="profit_per_night"
          />
          <StatusCard
            title="Punto de Equilibrio"
            value={`${data.breakeven.currentOccupancy.toFixed(0)}%`}
            status={data.breakeven.gapToBreakEven >= 0 ? 'good' : 'bad'}
            label={data.breakeven.gapToBreakEven >= 0 
              ? `${Math.abs(data.breakeven.gapToBreakEven).toFixed(0)}pp sobre el mínimo` 
              : `${Math.abs(data.breakeven.gapToBreakEven).toFixed(0)}pp bajo el mínimo`}
            subtitle={`necesitás ${data.breakeven.breakEvenOccupancy.toFixed(0)}% para cubrir costos`}
            helpKey="breakeven_occupancy"
          />
        </div>

        {/* Period Summary Stats */}
        <PeriodSummaryStats 
          health={data.health}
          breakeven={data.breakeven}
          comparisons={data.comparisons}
        />
            </section>

      {/* Cobranzas Pendientes Alert */}
      {data.cash.totalPending > 10000 && (
        <section className={styles.collectionsAlert}>
          <div className={styles.collectionsAlertIcon}>
            <CreditCard size={24} />
          </div>
          <div className={styles.collectionsAlertContent}>
            <div className={styles.collectionsAlertHeader}>
              <strong>Pendiente por cobrar</strong>
              <span className={styles.collectionsAlertAmount}>{formatCurrencyShort(data.cash.totalPending)}</span>
            </div>
            <div className={styles.collectionsAlertDetails}>
              {data.cash.aging.overdue > 0 && (
                <span className={styles.collectionsOverdue}>
                  {formatCurrencyShort(data.cash.aging.overdue)} vencido
                </span>
              )}
              {data.cash.aging.next7Days > 0 && (
                <span className={styles.collectionsUpcoming}>
                  {formatCurrencyShort(data.cash.aging.next7Days)} próximos 7 días
                </span>
              )}
            </div>
          </div>
          <Link to="/acciones" className={styles.collectionsAlertAction}>
            Ver cobranzas
            <ChevronRight size={16} />
          </Link>
        </section>
      )}

      {/* Section 2: Canales - Versión Resumida */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<BarChart3 size={20} />} 
          title="Canales y Distribución" 
          subtitle="¿Dónde está entrando el dinero?"
          link="/canales"
        />
        
        <div className={styles.channelSummaryGrid}>
          <div className={styles.otaDependencyCompact}>
            <div className={styles.otaDependencyHeader}>
              <span>Mix de canales</span>
              <HelpTooltip termKey="ota_dependency" size="sm" />
            </div>
            <div className={styles.otaDependencyBar}>
              <div className={styles.otaDependencyDirect} style={{ width: `${data.channels.otaDependency.directShare}%` }} />
              <div className={styles.otaDependencyOta} style={{ width: `${data.channels.otaDependency.otaShare}%` }} />
            </div>
            <div className={styles.otaDependencyLabels}>
              <span className={styles.otaLabelDirect}>
                <span className={styles.otaDot} style={{ background: 'var(--color-success)' }} />
                Directo {data.channels.otaDependency.directShare}%
              </span>
              <span className={styles.otaLabelOta}>
                <span className={styles.otaDot} style={{ background: 'var(--color-warning)' }} />
                OTAs {data.channels.otaDependency.otaShare}%
              </span>
            </div>
            {data.channels.otaDependency.isOverDependent && (
              <div className={styles.otaDependencyWarning}>
                <AlertTriangle size={14} />
                <span>Alta dependencia de OTAs (más comisiones)</span>
              </div>
            )}
          </div>

          <div className={styles.channelHighlights}>
            <div className={styles.channelHighlightItem}>
              <span className={styles.highlightLabel}>Mejor Canal</span>
              <span className={styles.highlightValue}>{data.channels.bestChannelByProfitPerNight}</span>
              <span className={styles.highlightSubtext}>por rentabilidad/noche</span>
            </div>
            <div className={styles.channelHighlightItem}>
              <span className={styles.highlightLabel}>Peor Canal</span>
              <span className={styles.highlightValue}>{data.channels.worstChannelByProfitPerNight}</span>
              <span className={styles.highlightSubtext}>por rentabilidad/noche</span>
            </div>
                </div>
              </div>
            </section>

      {/* Quick Links / Navigation */}
      <section className={styles.quickLinksSection}>
        <SectionHeader 
          icon={<ArrowRight size={20} />} 
          title="Análisis Profundo" 
          subtitle="Explorá los detalles de tu operación"
        />
        <div className="quick-actions">
          <Link to="/rentabilidad" className="quick-action">
            <DollarSign size={24} />
            <div className="quick-action-content">
              <span>Rentabilidad y P&L</span>
              <p>Analizá reserva por reserva, comparativas MoM/YoY y tendencias.</p>
            </div>
          <ChevronRight size={20} />
        </Link>
        <Link to="/canales" className="quick-action">
          <BarChart3 size={24} />
            <div className="quick-action-content">
              <span>Canales Detallados</span>
              <p>Comisiones reales, ADR neto por canal y mix de distribución.</p>
            </div>
          <ChevronRight size={20} />
        </Link>
        <Link to="/costos" className="quick-action">
          <Target size={24} />
            <div className="quick-action-content">
              <span>Gestión de Costos</span>
              <p>Ajustá tus costos fijos y variables para ver el impacto real.</p>
            </div>
          <ChevronRight size={20} />
        </Link>
        </div>
          </section>
    </div>
  );
}

// =====================================================
// Sub-Components
// =====================================================

function StatusCard({ 
  title, 
  value, 
  status, 
  label, 
  helpKey,
  subtitle,
  comparison 
}: { 
  title: string; 
  value: string; 
  status: string; 
  label: string; 
  helpKey?: string;
  subtitle?: string;
  comparison?: { value: number | null; label: string } | null;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'bad': return 'var(--color-error)';
      default: return 'var(--color-text-muted)';
    }
  };

  const formatComparison = (val: number | null) => {
    if (val === null || val === undefined || isNaN(val)) return null;
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className={styles.statusCard}>
      <div className={styles.statusCardHeader}>
        <span className={styles.statusCardTitle}>{title}</span>
        {helpKey && <HelpTooltip termKey={helpKey} size="sm" />}
      </div>
      <span className={styles.statusCardValue}>{value}</span>
      {subtitle && <span className={styles.statusCardSubtitle}>{subtitle}</span>}
      <div className={styles.statusCardFooter}>
        <div className={styles.statusCardIndicator}>
          <div className={styles.statusDot} style={{ backgroundColor: getStatusColor() }} />
          <span className={styles.statusLabel}>{label}</span>
        </div>
        {comparison && comparison.value !== null && formatComparison(comparison.value) && (
          <span className={`${styles.statusCardComparison} ${comparison.value >= 0 ? styles.positive : styles.negative}`}>
            {formatComparison(comparison.value)} {comparison.label}
          </span>
        )}
      </div>
    </div>
  );
}

function DataConfidenceBanner({ confidence: _confidence, onAction: _onAction }: { confidence: any; onAction: () => void }) {
  return null;
  // const score = typeof confidence.score === 'number' ? confidence.score : 0;
  // const missing = Array.isArray(confidence.missingForHighConfidence) ? confidence.missingForHighConfidence : [];
  
  // return (
  //   <div className={`confidence-banner confidence-banner--${confidence.level}`}>
  //     <div className="confidence-banner__icon">
  //       {confidence.level === 'low' ? <AlertCircle size={20} /> : <AlertCircle size={20} />}
  //     </div>
  //     <div className="confidence-banner__content">
  //       <strong>
  //         Confianza de datos: {confidence.level === 'low' ? 'BAJA' : 'MEDIA'} ({score}/100)
  //       </strong>
  //       <p>
  //         {missing.slice(0, 2).join(' • ')}
  //       </p>
  //     </div>
  //     <button 
  //       onClick={onAction} 
  //       className="confidence-banner__action"
  //       style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}
  //     >
  //       Completar
  //     </button>
  //   </div>
  // );
}

function CostsNotConfiguredBanner({ unitEconomics }: { unitEconomics: any }) {
  // Si no hay costos fijos configurados, mostrar advertencia
  if (!unitEconomics || unitEconomics.cporBreakdown?.fixed > 0) return null;
  
  return (
    <div className={styles.costsBanner}>
      <div className={styles.costsBannerIcon}>
        <AlertTriangle size={24} />
      </div>
      <div className={styles.costsBannerContent}>
        <strong>⚠️ Tus ganancias no descuentan gastos fijos</strong>
        <p>Los números de profit que ves son irrealmente altos porque no tenés configurados costos fijos (sueldos, alquiler, servicios). Configurá tus costos para ver profit real.</p>
      </div>
      <a 
        href="/costos" 
        className={styles.costsBannerAction}
      >
        Configurar costos
      </a>
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

function PeriodSummaryStats({ 
  health, 
  breakeven,
  comparisons 
}: { 
  health: any;
  breakeven: any;
  comparisons: CommandCenterData['comparisons'];
}) {
  const mom = comparisons?.mom;
  const revenue = mom?.metrics.revenue.current || 0;
  const revenueChange = mom?.metrics.revenue.changePercent;
  
  const adr = health?.kpis?.adr?.value || 0;
  const adrChange = mom?.metrics.adr?.changePercent;
  
  const nightsSold = breakeven?.nightsSoldThisPeriod || 0;
  
  // Calculate reservations estimate from nights and avg stay
  const avgStay = nightsSold > 0 ? Math.max(2, Math.round(nightsSold / Math.max(1, Math.floor(nightsSold / 3)))) : 0;
  const estimatedReservations = nightsSold > 0 ? Math.round(nightsSold / avgStay) : 0;

  const formatChange = (val: number | undefined | null) => {
    if (val === null || val === undefined || isNaN(val) || Math.abs(val) < 0.1) return null;
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  return (
    <div className={styles.periodSummary}>
      <div className={styles.periodSummaryItem}>
        <span className={styles.periodSummaryValue}>{formatCurrencyShort(revenue)}</span>
        <span className={styles.periodSummaryLabel}>Revenue</span>
        {formatChange(revenueChange) && (
          <span className={`${styles.periodSummaryChange} ${revenueChange && revenueChange >= 0 ? styles.positive : styles.negative}`}>
            {formatChange(revenueChange)} vs ant.
          </span>
        )}
      </div>
      <div className={styles.periodSummaryDivider} />
      <div className={styles.periodSummaryItem}>
        <span className={styles.periodSummaryValue}>{formatCurrencyShort(adr)}</span>
        <span className={styles.periodSummaryLabel}>ADR</span>
        {formatChange(adrChange) && (
          <span className={`${styles.periodSummaryChange} ${adrChange && adrChange >= 0 ? styles.positive : styles.negative}`}>
            {formatChange(adrChange)} vs ant.
          </span>
        )}
      </div>
      <div className={styles.periodSummaryDivider} />
      <div className={styles.periodSummaryItem}>
        <span className={styles.periodSummaryValue}>{nightsSold}</span>
        <span className={styles.periodSummaryLabel}>Noches vendidas</span>
      </div>
      <div className={styles.periodSummaryDivider} />
      <div className={styles.periodSummaryItem}>
        <span className={styles.periodSummaryValue}>~{estimatedReservations}</span>
        <span className={styles.periodSummaryLabel}>Reservas</span>
      </div>
    </div>
  );
}

function PeriodComparisonWidget({ comparisons }: { comparisons: CommandCenterData['comparisons'] }) {
  const mom = comparisons?.mom;
  
  // Check if we have valid comparison data
  const hasValidData = mom && 
    mom.metrics.netProfit && 
    (mom.metrics.netProfit.previous !== 0 || mom.metrics.netProfit.current !== 0);
  
  const changePercent = mom?.metrics.netProfit?.changePercent;
  const hasMeaningfulChange = changePercent !== null && 
    changePercent !== undefined && 
    !isNaN(changePercent) && 
    Math.abs(changePercent) > 0.1;

  if (!hasValidData) {
    return (
      <div className={styles.contextItem}>
        <span className={styles.contextLabel}>vs período anterior</span>
        <div className={styles.contextValueMuted}>
          Sin datos previos
        </div>
        <span className={styles.contextSubtext}>Importá más meses</span>
      </div>
    );
  }

  if (!hasMeaningfulChange) {
    return (
      <div className={styles.contextItem}>
        <span className={styles.contextLabel}>vs período anterior</span>
        <div className={styles.contextValueMuted}>
          ≈ Similar
        </div>
        <span className={styles.contextSubtext}>Sin cambios significativos</span>
      </div>
    );
  }

  const isPositive = changePercent >= 0;
  
  return (
    <div className={styles.contextItem}>
      <span className={styles.contextLabel}>vs período anterior</span>
      <div className={`${styles.contextValue} ${isPositive ? styles.positive : styles.negative}`}>
        {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
      </div>
      <span className={styles.contextSubtext}>
        {isPositive ? 'Mejorando' : 'Bajando'}
      </span>
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



