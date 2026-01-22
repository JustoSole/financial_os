import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getCommandCenter } from '../api';
import { DateRangePicker, HelpTooltip } from '../components';
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
  CreditCard,
  Zap,
  ChevronRight,
  Clock,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
} from '../components/ui';
import DataHealthBanner from '../components/DataHealthBanner';
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
  const { property, dateRange, refreshData } = useApp();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!property?.id) return;
      setLoading(true);

      const startStr = dateRange.start.toISOString().substring(0, 10);
      const endStr = dateRange.end.toISOString().substring(0, 10);

      const [commandRes] = await Promise.all([
        getCommandCenter(property.id, startStr, endStr),
      ]);

      if (commandRes.success) setData(commandRes.data);

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
          title="Conectá tus datos de Cloudbeds" 
          description="Para ver tu Dashboard, necesitamos subir tus reportes de Cloudbeds. El proceso toma menos de 2 minutos." 
          action={{ 
            label: 'Ir a Importar datos', 
            onClick: () => window.location.href = '/importar'
          }}
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
      <DataConfidenceBanner 
        confidence={data.dataConfidence} 
        onAction={() => window.location.href = '/importar'} 
      />

      {/* Demo Mode Banner */}
      {data.dataConfidence.score >= 90 && (
        <div style={{ 
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-3) var(--space-4)', 
          background: 'var(--color-primary-subtle)', 
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          border: '1px solid var(--color-primary-light)'
        }}>
          <Zap size={18} fill="currentColor" />
          <div>
            <strong>Modo Demo Activo:</strong> Estás viendo datos de ejemplo para explorar la herramienta. 
            <Link to="/importar" style={{ marginLeft: 'var(--space-2)', fontWeight: 600, textDecoration: 'underline' }}>
              Cargá tus propios reportes aquí
            </Link>
          </div>
        </div>
      )}

      {/* Costs Not Configured Banner */}
      <CostsNotConfiguredBanner unitEconomics={data.unitEconomics} />

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
          <button 
            onClick={() => window.location.href = '/importar'} 
            className={styles.historyWarningAction}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}
          >
            Importar historia
          </button>
        </div>
      )}

      {/* Weekly Action - THE action to take this week */}
      <div className={styles.priorityActionWrapper}>
        <WeeklyActionCard action={data.weeklyAction} isProminent />
      </div>

      {/* Section 1: Business Health in 60 seconds */}
      <section className={styles.commandSection}>
        <SectionHeader 
          icon={<Zap size={20} />} 
          title="Estado Actual" 
          subtitle="Lo que necesitás saber para decidir hoy"
        />
        
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
                Profit neto operativo <Badge variant="warning" size="sm">Estimado</Badge>
          </div>
        </div>

            {/* Context context context */}
            <div className={styles.heroProfitContext}>
        {data.comparisons.mom && (
                <div className={styles.contextItem}>
                  <span className={styles.contextLabel}>vs período anterior</span>
                  <div className={`${styles.contextValue} ${data.comparisons.mom.metrics.netProfit?.changePercent && data.comparisons.mom.metrics.netProfit.changePercent >= 0 ? styles.positive : styles.negative}`}>
                    {data.comparisons.mom.metrics.netProfit?.changePercent && data.comparisons.mom.metrics.netProfit.changePercent >= 0 ? '+' : ''}
                    {data.comparisons.mom.metrics.netProfit?.changePercent?.toFixed(1)}%
            </div>
          </div>
              )}
              <div className={styles.contextItem}>
                <span className={styles.contextLabel}>Punto de equilibrio</span>
                <div className={`${styles.contextValue} ${data.breakeven.gapToBreakEven >= 0 ? styles.positive : styles.negative}`}>
                  {data.breakeven.gapToBreakEven >= 0 ? 'CUBIERTO' : 'EN RIESGO'}
              </div>
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
            label={data.health.kpis.occupancy.status === 'good' ? 'Saludable' : 'Baja'}
          />
          <StatusCard
            title="Margen / Noche"
            value={formatCurrencyShort(data.unitEconomics.profitPerNight)}
            status={data.unitEconomics.profitPerNight > 0 ? 'good' : 'bad'}
            label={data.unitEconomics.profitPerNight > 0 ? 'Ganando' : 'Perdiendo'}
          />
          <StatusCard
            title="Punto de Equilibrio"
            value={`${data.breakeven.currentOccupancy.toFixed(0)}% / ${data.breakeven.breakEvenOccupancy.toFixed(0)}%`}
            status={data.breakeven.gapToBreakEven >= 0 ? 'good' : 'bad'}
            label={data.breakeven.gapToBreakEven >= 0 ? 'Arriba' : 'Debajo'}
          />
              </div>
            </section>

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
              <span>Dependencia de portales: <strong>{data.channels.otaDependency.otaShare}%</strong></span>
              {data.channels.otaDependency.isOverDependent && <AlertTriangle size={16} className="text-warning" />}
            </div>
            <div className={styles.otaDependencyBar}>
              <div className={styles.otaDependencyDirect} style={{ width: `${data.channels.otaDependency.directShare}%` }} />
              <div className={styles.otaDependencyOta} style={{ width: `${data.channels.otaDependency.otaShare}%` }} />
            </div>
          </div>

          <div className={styles.channelHighlights}>
            <div className={styles.channelHighlightItem}>
              <span className={styles.highlightLabel}>Mejor Canal</span>
              <span className={styles.highlightValue}>{data.channels.bestChannelByProfitPerNight}</span>
            </div>
            <div className={styles.channelHighlightItem}>
              <span className={styles.highlightLabel}>Peor Canal</span>
              <span className={styles.highlightValue}>{data.channels.worstChannelByProfitPerNight}</span>
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

function StatusCard({ title, value, status, label }: { title: string; value: string; status: string; label: string }) {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'bad': return 'var(--color-error)';
      default: return 'var(--color-text-muted)';
    }
  };

  return (
    <div className={styles.statusCard}>
      <span className={styles.statusCardTitle}>{title}</span>
      <span className={styles.statusCardValue}>{value}</span>
      <div className={styles.statusCardIndicator}>
        <div className={styles.statusDot} style={{ backgroundColor: getStatusColor() }} />
        <span className={styles.statusLabel}>{label}</span>
      </div>
    </div>
  );
}

function DataConfidenceBanner({ confidence, onAction }: { confidence: any; onAction: () => void }) {
  if (confidence.level === 'high') return null;
  
  return (
    <div className={`confidence-banner confidence-banner--${confidence.level}`}>
      <div className="confidence-banner__icon">
        {confidence.level === 'low' ? <AlertCircle size={20} /> : <AlertCircle size={20} />}
      </div>
      <div className="confidence-banner__content">
        <strong>
          Confianza de datos: {confidence.level === 'low' ? 'BAJA' : 'MEDIA'} ({confidence.score}/100)
        </strong>
        <p>
          {confidence.missingForHighConfidence.slice(0, 2).join(' • ')}
        </p>
      </div>
      <button 
        onClick={onAction} 
        className="confidence-banner__action"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}
      >
        Completar
      </button>
    </div>
  );
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

function WeeklyActionCard({ action, isProminent }: { action: any, isProminent?: boolean }) {
  const getIcon = () => {
    switch (action.type) {
      case 'collect_pending': return <CreditCard size={isProminent ? 32 : 24} />;
      case 'reduce_commission': return <Percent size={isProminent ? 32 : 24} />;
      case 'raise_adr': return <TrendingUp size={isProminent ? 32 : 24} />;
      case 'cut_costs': return <TrendingDown size={isProminent ? 32 : 24} />;
      case 'improve_data': return <Upload size={isProminent ? 32 : 24} />;
      default: return <Zap size={isProminent ? 32 : 24} />;
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
    <div className={`weekly-action weekly-action--priority-${action.priority} ${isProminent ? 'weekly-action--prominent' : ''}`}>
      <div className="weekly-action__icon">{getIcon()}</div>
      <div className="weekly-action__content">
        <div className="weekly-action__label">Acción de la semana</div>
        <div className="weekly-action__title">{action.title}</div>
        <div className="weekly-action__impact">{action.impact}</div>
      </div>
      <Link to={getLink()} className="weekly-action__link">
        {isProminent ? 'Ver por qué' : <ArrowRight size={20} />}
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



