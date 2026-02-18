import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  getReservationEconomics,
  getReservationEconomicsList,
  getReservationEconomicsDetail,
  getBreakEven,
  getMinimumPrice,
  getTrends,
  getRoomTypes,
} from '../api';
import {
  PeriodSelector,
  ReservationDrawer,
  Card,
  LoadingState,
  TrustBadge,
  ChannelBadge,
  SummaryMetric,
  HelpTooltip,
  ComparisonSection,
  TrendChart,
  EmptyState,
} from '../components';
import type { ReservationEconomicsData } from '../components';
import { formatCurrency, formatCurrencyShort, formatPercent } from '../utils/formatters';
import { Target, Shield, Info, TrendingUp, BarChart3, Database } from 'lucide-react';
import styles from './Profitability.module.css';


// =====================================================
// Types
// =====================================================

interface Pattern {
  source: string;
  nightsBucket: '1' | '2' | '3+';
  count: number;
  totalRevenue: number;
  totalProfit: number;
  avgProfitPerNight: number;
  isLossPattern: boolean;
  lossAmount: number;
}

interface Summary {
  totalReservations: number;
  totalRoomNights: number;
  totalRevenue: number;
  totalCommissions: number;
  totalVariableCosts: number;
  totalFixedCostsAllocated: number;
  totalNetProfit: number;
  avgMarginPercent: number;
  avgProfitPerNight: number;
  goppar: number;
  unprofitableCount: number;
  unprofitableLoss: number;
  unprofitableShare: number;
  patterns: Pattern[];
  worstReservations: ReservationEconomicsData[];
  bestReservations: ReservationEconomicsData[];
  lowConfidenceCount: number;
  lowConfidenceShare: number;
  configUsed: {
    variableCostPerNight: number;
    cleaningCostPerStay: number;
    monthlyFixedCosts: number;
    defaultCommissionRate: number;
  };
}

type TabType = 'thresholds' | 'analysis' | 'worst' | 'best' | 'patterns' | 'all';
type NightsBucket = '1' | '2' | '3+' | 'all';

// =====================================================
// Main Component
// =====================================================

export default function Profitability() {
  const { property, dateRange } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reservations, setReservations] = useState<ReservationEconomicsData[]>([]);
  const [breakEven, setBreakEven] = useState<any>(null);
  const [trends, setTrends] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'adr' | 'occupancy' | 'revpar' | 'netProfit'>('revenue');

  // Transform backend trends to TrendChart format
  const formattedTrends = useMemo(() => {
    try {
      if (!trends || !trends.points || !Array.isArray(trends.points)) return null;
      
      const metrics = ['revenue', 'adr', 'occupancy', 'revpar', 'netProfit'];
      const result: any = {};
      
      metrics.forEach(metric => {
        result[metric] = trends.points.map((p: any) => {
          if (!p || !p.date) return null;
          
          // Ensure date is valid for parsing
          const dateStr = p.date.includes('-') ? p.date : `${p.date.substring(0,4)}-${p.date.substring(4,6)}`;
          const label = new Date(dateStr + '-02').toLocaleDateString('es-AR', { month: 'short' });
          
          return {
            month: p.date,
            label: label !== 'Invalid Date' ? label : p.date,
            value: Number(p[metric]) || 0
          };
        }).filter(Boolean);
      });
      
      return result;
    } catch (err) {
      console.error('Error formatting trends:', err);
      return null;
    }
  }, [trends]);

  const [comparisons, setComparisons] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('thresholds');

  // Sandbox state
  const [marginPct, setMarginPct] = useState(20);
  const [simulation, setSimulation] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [nightsFilter, setNightsFilter] = useState<NightsBucket>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [roomTypes, setRoomTypes] = useState<Array<{ roomType: string; count: number; share: number }>>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationEconomicsData | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!property?.id) return;
      setLoading(true);
      setLoadError(null);
      try {
        const startStr = dateRange.start.toISOString().substring(0, 10);
        const endStr = dateRange.end.toISOString().substring(0, 10);

        const { getCommandCenter } = await import('../api');

        const roomTypesRes = await getRoomTypes(property.id, startStr, endStr);
        if (roomTypesRes.success && roomTypesRes.data) {
          setRoomTypes(roomTypesRes.data);
        }

        const roomTypeParam = roomTypeFilter !== 'all' ? roomTypeFilter : undefined;

        const [summaryRes, listRes, breakEvenRes, trendsRes, commandRes] = await Promise.all([
          getReservationEconomics(property.id, startStr, endStr, roomTypeParam),
          getReservationEconomicsList(property.id, startStr, endStr, { roomType: roomTypeParam } as any),
          getBreakEven(property.id, startStr, endStr),
          getTrends(property.id, 6),
          getCommandCenter(property.id, startStr, endStr)
        ]);

        if (summaryRes.success) setSummary(summaryRes.data);
        if (listRes.success) setReservations(listRes.data || []);
        if (breakEvenRes.success) setBreakEven(breakEvenRes.data);
        if (trendsRes.success) setTrends(trendsRes.data);
        if (commandRes.success) setComparisons(commandRes.data.comparisons);

        if (!summaryRes.success && !listRes.success) {
          setLoadError(summaryRes.error || listRes.error || 'No se pudieron cargar los datos de rentabilidad.');
        }
      } catch (err) {
        setLoadError('Error al conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
        setSummary(null);
        setReservations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [property?.id, dateRange, roomTypeFilter]);

  useEffect(() => {
    async function runSim() {
      if (!property?.id || activeTab !== 'thresholds') return;
      setSimLoading(true);
      try {
        const res = await getMinimumPrice(property.id, marginPct);
        if (res.success) setSimulation(res.data);
      } finally {
        setSimLoading(false);
      }
    }
    const timer = setTimeout(runSim, 300);
    return () => clearTimeout(timer);
  }, [property?.id, marginPct, activeTab]);

  // Get unique sources for filter
  const sources = useMemo(() => {
    const unique = [...new Set(reservations.map((r) => r.source))];
    return unique.sort();
  }, [reservations]);

  // Filter reservations
  const filteredReservations = useMemo(() => {
    let result = [...reservations];

    if (sourceFilter !== 'all') {
      result = result.filter((r) => r.source === sourceFilter);
    }

    if (nightsFilter !== 'all') {
      result = result.filter((r) => {
        if (nightsFilter === '1') return r.roomNights === 1;
        if (nightsFilter === '2') return r.roomNights === 2;
        return r.roomNights >= 3;
      });
    }

    return result;
  }, [reservations, sourceFilter, nightsFilter]);

  // Get data based on active tab
  const displayData = useMemo(() => {
    if (activeTab === 'worst') {
      return filteredReservations.filter((r) => r.isUnprofitable).slice(0, 20);
    }
    if (activeTab === 'best') {
      return [...filteredReservations]
        .filter((r) => !r.isUnprofitable)
        .sort((a, b) => b.profitPerNight - a.profitPerNight)
        .slice(0, 20);
    }
    if (activeTab === 'all') {
      return filteredReservations;
    }
    return [];
  }, [filteredReservations, activeTab]);

  // Open drawer
  const openDrawer = async (reservationNumber: string) => {
    if (!property?.id) return;
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const res = await getReservationEconomicsDetail(property.id, reservationNumber);
      if (res.success && res.data) {
        setSelectedReservation(res.data);
      }
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedReservation(null);
  };

  if (loading) {
    return <LoadingState message="Analizando rentabilidad..." />;
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Rentabilidad por Noche
              <HelpTooltip termKey="unitEconomics" size="md" />
            </h1>
            <p className="page-subtitle">Ganancia neta y margen operativo prorrateado por noche ocupada</p>
          </div>
          <PeriodSelector />
        </div>
        <EmptyState
          icon={<Database size={48} />}
          title="No se pudo cargar el análisis"
          description={loadError}
          action={{ label: 'Ir a Importar', to: '/importar' }}
        />
      </div>
    );
  }

  if (!summary || summary.totalReservations === 0) {
    return (
      <div className={styles.page}>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Rentabilidad por Noche
              <HelpTooltip termKey="unitEconomics" size="md" />
            </h1>
            <p className="page-subtitle">Ganancia neta y margen operativo prorrateado por noche ocupada</p>
          </div>
          <PeriodSelector />
        </div>
        
        <EmptyState
          icon={<Database size={48} />}
          title="Sin datos de noches"
          description="Importá el reporte 'Reservations with Financials' para ver el análisis de rentabilidad por noche."
          action={{
            label: "Ir a Importar",
            to: "/importar"
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Rentabilidad por Noche
            <HelpTooltip termKey="unitEconomics" size="md" />
          </h1>
          <p className="page-subtitle">Ganancia neta y margen operativo prorrateado por noche ocupada</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Summary Cards */}
      <div className={styles.summary}>
        <SummaryMetric value={summary?.totalRoomNights || 0} label="Noches analizadas" />
        <SummaryMetric
          value={formatCurrency(summary?.totalNetProfit || 0)}
          label="Ganancia neta total"
          variant={(summary?.totalNetProfit || 0) >= 0 ? 'positive' : 'negative'}
        />
        <SummaryMetric
          value={`${(summary?.avgMarginPercent || 0).toFixed(1)}%`}
          label="Margen promedio"
        />
        {(summary?.unprofitableCount || 0) > 0 && (
          <SummaryMetric
            value={summary?.unprofitableCount || 0}
            label={`Noches con pérdida (${(summary?.unprofitableShare || 0).toFixed(1)}%)`}
            variant="danger"
          />
        )}
        {(summary?.unprofitableLoss || 0) > 0 && (
          <SummaryMetric
            value={`-${formatCurrency(summary?.unprofitableLoss || 0)}`}
            label="Total perdido"
            variant="danger"
          />
        )}
      </div>

      {/* Config Used */}
      <div className={styles.config}>
        <span className={styles.configLabel}>Costos configurados:</span>
        <span className={styles.configItem}>
          Variable: ${summary?.configUsed?.variableCostPerNight || 0}/noche
        </span>
        <span className={styles.configItem}>
          Fijos: ${(summary?.configUsed?.monthlyFixedCosts || 0).toLocaleString()}/mes
        </span>
        <span className={styles.configItem}>
          Comisión default: {((summary?.configUsed?.defaultCommissionRate || 0) * 100).toFixed(0)}%
        </span>
        {(summary?.configUsed?.variableCostPerNight || 0) === 0 && (
          <span className={styles.configWarning} style={{ color: 'var(--color-error)', fontWeight: 'bold', marginLeft: '12px' }}>
            ⚠️ Sin costos variables: Márgenes inflados
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'thresholds' ? styles.active : ''}`}
            onClick={() => setActiveTab('thresholds')}
          >
            <Shield size={16} /> Umbrales + Simulador
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'analysis' ? styles.active : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <BarChart3 size={16} /> Tendencias y Comparativas
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'worst' ? styles.active : ''}`}
            onClick={() => setActiveTab('worst')}
          >
            🔴 Peores ({filteredReservations.filter((r) => r.isUnprofitable).length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'best' ? styles.active : ''}`}
            onClick={() => setActiveTab('best')}
          >
            🟢 Mejores
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'patterns' ? styles.active : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            📊 Patrones
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
            onClick={() => setActiveTab('all')}
          >
            📋 Todas
          </button>
        </div>

        {activeTab !== 'patterns' && activeTab !== 'thresholds' && activeTab !== 'analysis' && (
          <div className={styles.filters}>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Todos los canales</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={nightsFilter}
              onChange={(e) => setNightsFilter(e.target.value as NightsBucket)}
              className={styles.filterSelect}
            >
              <option value="all">Todas las noches</option>
              <option value="1">1 noche</option>
              <option value="2">2 noches</option>
              <option value="3+">3+ noches</option>
            </select>
            {roomTypes.length > 0 && (
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">Todos los tipos</option>
                {roomTypes.slice(0, 10).map((rt) => (
                  <option key={rt.roomType} value={rt.roomType}>
                    {rt.roomType} ({rt.count})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Content based on tab */}
      {activeTab === 'thresholds' ? (
        <ThresholdsView
          breakEven={breakEven}
          summary={summary}
          marginPct={marginPct}
          setMarginPct={setMarginPct}
          simulation={simulation}
          loading={simLoading}
        />
      ) : activeTab === 'analysis' ? (
        <AnalysisView 
          trends={formattedTrends} 
          comparisons={comparisons} 
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
        />
      ) : activeTab === 'patterns' ? (
        <PatternsView patterns={summary.patterns} />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className={styles.mobileCardList}>
            {displayData.map((r) => (
              <div
                key={r.reservationNumber}
                className={`${styles.mobileCard} ${r.isUnprofitable ? styles.unprofitable : styles.profitable}`}
                onClick={() => openDrawer(r.reservationNumber)}
              >
                <div className={styles.mobileCardHeader}>
                  <div>
                    <div className={styles.mobileCardId}>{r.reservationNumber}</div>
                    <div className={styles.mobileCardGuest}>{r.guestName}</div>
                  </div>
                  <div className={styles.mobileCardProfit}>
                    <div className={`${styles.mobileCardProfitValue} ${r.netProfit >= 0 ? styles.positive : styles.negative}`}>
                      {formatCurrencyShort(r.netProfit)}
                    </div>
                    <div className={styles.mobileCardProfitLabel}>profit</div>
                  </div>
                </div>
                <div className={styles.mobileCardDetails}>
                  <div className={styles.mobileCardDetail}>
                    <span className={styles.mobileCardDetailLabel}>Canal</span>
                    <span className={styles.mobileCardChannel}>{r.source}</span>
                  </div>
                  <div className={styles.mobileCardDetail}>
                    <span className={styles.mobileCardDetailLabel}>Noches</span>
                    <span className={styles.mobileCardDetailValue}>{r.roomNights}</span>
                  </div>
                  <div className={styles.mobileCardDetail}>
                    <span className={styles.mobileCardDetailLabel}>$/Noche</span>
                    <span className={`${styles.mobileCardDetailValue} ${r.profitPerNight >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrencyShort(r.profitPerNight)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {displayData.length === 0 && (
              <div className={styles.tableEmpty}>
                <p>No hay reservas que coincidan con los filtros</p>
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <Card padding="none" className={`${styles.tableCard} table-responsive`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Canal</th>
                  <th className="text-right">Noches</th>
                  <th className="text-right">Ingresos</th>
                  <th className="text-right">Comisión</th>
                  <th className="text-right">Ganancia</th>
                  <th className="text-right">$/Noche</th>
                  <th>Precisión</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((r) => (
                  <tr
                    key={r.reservationNumber}
                    className={r.isUnprofitable ? styles.unprofitable : ''}
                    onClick={() => openDrawer(r.reservationNumber)}
                  >
                    <td data-label="Reserva">
                      <div className={styles.cellReservation}>
                        <span className={styles.reservationNumber}>{r.reservationNumber}</span>
                        <span className={styles.reservationGuest}>{r.guestName}</span>
                      </div>
                    </td>
                    <td data-label="Canal">
                      <ChannelBadge channel={r.source} category={r.sourceCategory} />
                    </td>
                    <td data-label="Noches" className="text-right font-mono">{r.roomNights}</td>
                    <td data-label="Ingresos" className="text-right font-mono">{formatCurrencyShort(r.revenue)}</td>
                    <td data-label="Comisión" className="text-right font-mono text-muted">
                      {(r.commissionRate * 100).toFixed(0)}%
                    </td>
                    <td
                      data-label="Ganancia"
                      className={`text-right font-mono font-semibold ${r.netProfit >= 0 ? 'text-success' : 'text-error'}`}
                    >
                      {formatCurrencyShort(r.netProfit)}
                    </td>
                    <td
                      data-label="$/Noche"
                      className={`text-right font-mono ${r.profitPerNight >= 0 ? 'text-success' : 'text-error'}`}
                    >
                      {formatCurrencyShort(r.profitPerNight)}
                    </td>
                    <td data-label="Precisión">
                      <div className={styles.confidenceCell}>
                        <TrustBadge trust={r.trust} />
                        {/* <ConfidenceBadge confidence={r.confidence} /> */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {displayData.length === 0 && (
              <div className={styles.tableEmpty}>
                <p>No hay reservas que coincidan con los filtros</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Drawer */}
      <ReservationDrawer
        reservation={selectedReservation}
        loading={drawerLoading}
        open={drawerOpen}
        onClose={closeDrawer}
      />
    </div>
  );
}

// =====================================================
// Analysis View Component (Trends + Comparisons)
// =====================================================

function AnalysisView({ 
  trends, 
  comparisons, 
  selectedMetric, 
  setSelectedMetric 
}: { 
  trends: any; 
  comparisons: any; 
  selectedMetric: 'revenue' | 'adr' | 'occupancy' | 'revpar' | 'netProfit';
  setSelectedMetric: (m: 'revenue' | 'adr' | 'occupancy' | 'revpar' | 'netProfit') => void;
}) {
  if (!trends && !comparisons) {
    return (
      <div className={styles.noDataMessage}>
        <Info size={24} />
        <p>No hay datos de tendencias o comparativas disponibles para este período.</p>
      </div>
    );
  }

  return (
    <div className={styles.analysisContainer}>
      {/* Comparisons Row */}
      <div className={styles.analysisGrid}>
        <Card className={styles.analysisCard}>
          <h3 className={styles.analysisTitle}>
            <TrendingUp size={20} className="text-primary" />
            Comparativa MoM
          </h3>
          {comparisons?.mom?.metrics ? (
            <ComparisonSection
              title="vs Período Anterior"
              periodLabel={comparisons.mom.previousPeriod || 'período anterior'}
              metrics={[
                { 
                  label: 'Revenue', 
                  current: Number(comparisons.mom.metrics.revenue?.current) || 0, 
                  previous: Number(comparisons.mom.metrics.revenue?.previous) || 0, 
                  formatter: formatCurrencyShort 
                },
                { 
                  label: 'Profit Neto', 
                  current: Number(comparisons.mom.metrics.netProfit?.current) || 0, 
                  previous: Number(comparisons.mom.metrics.netProfit?.previous) || 0, 
                  formatter: formatCurrencyShort 
                },
                { 
                  label: 'Ocupación', 
                  current: Number(comparisons.mom.metrics.occupancy?.current) || 0, 
                  previous: Number(comparisons.mom.metrics.occupancy?.previous) || 0, 
                  formatter: (v) => `${(v || 0).toFixed(0)}%` 
                },
                { 
                  label: 'ADR', 
                  current: Number(comparisons.mom.metrics.adr?.current) || 0, 
                  previous: Number(comparisons.mom.metrics.adr?.previous) || 0, 
                  formatter: formatCurrencyShort 
                },
              ]}
            />
          ) : (
            <p className="text-muted text-sm">Sin datos suficientes para comparar con el período anterior.</p>
          )}
        </Card>

        <Card className={styles.analysisCard}>
          <h3 className={styles.analysisTitle}>
            <BarChart3 size={20} className="text-primary" />
            Comparativa YoY
          </h3>
          {comparisons?.yoy?.metrics ? (
            <ComparisonSection
              title="vs Año Anterior"
              periodLabel={comparisons.yoy.previousPeriod || 'año anterior'}
              metrics={[
                { 
                  label: 'Revenue', 
                  current: Number(comparisons.yoy.metrics.revenue?.current) || 0, 
                  previous: Number(comparisons.yoy.metrics.revenue?.previous) || 0, 
                  formatter: formatCurrencyShort 
                },
                { 
                  label: 'Ocupación', 
                  current: Number(comparisons.yoy.metrics.occupancy?.current) || 0, 
                  previous: Number(comparisons.yoy.metrics.occupancy?.previous) || 0, 
                  formatter: (v) => `${(v || 0).toFixed(0)}%` 
                },
                { 
                  label: 'ADR', 
                  current: Number(comparisons.yoy.metrics.adr?.current) || 0, 
                  previous: Number(comparisons.yoy.metrics.adr?.previous) || 0, 
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
        </Card>
      </div>

      {/* Trends Chart */}
      {trends && trends[selectedMetric] && trends[selectedMetric].length > 0 ? (
        <Card className={styles.trendCard}>
          <div className={styles.trendHeader}>
            <h3 className={styles.analysisTitle}>
              <TrendingUp size={20} className="text-primary" />
              Tendencias Históricas
            </h3>
            <div className={styles.metricSelector}>
              {(['revenue', 'netProfit', 'occupancy', 'adr'] as const).map((m) => (
                <button 
                  key={m}
                  className={`${styles.metricBtn} ${selectedMetric === m ? styles.active : ''}`}
                  onClick={() => setSelectedMetric(m)}
                >
                  {m === 'revenue' ? 'Revenue' : 
                   m === 'netProfit' ? 'Profit Neto' : 
                   m === 'occupancy' ? 'Ocupación' : 'ADR'}
                </button>
              ))}
            </div>
          </div>

          <TrendChart
            data={trends[selectedMetric]}
            title={
              selectedMetric === 'revenue' ? 'Revenue Mensual' :
              selectedMetric === 'occupancy' ? '% Ocupación' :
              selectedMetric === 'adr' ? 'ADR (Tarifa Promedio)' :
              'Profit Neto Operativo'
            }
            valueFormatter={
              selectedMetric === 'occupancy' 
                ? (v: number) => `${(v || 0).toFixed(1)}%` 
                : formatCurrencyShort
            }
            color={
              selectedMetric === 'netProfit' 
                ? 'var(--color-success)' 
                : 'var(--color-primary)'
            }
          />
        </Card>
      ) : trends ? (
        <Card className={styles.trendCard}>
          <div className={styles.noDataMessage}>
            <Info size={24} />
            <p>No hay datos históricos suficientes para mostrar el gráfico de tendencias.</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// =====================================================
// Thresholds View Component
// =====================================================

function ThresholdsView({
  breakEven,
  summary,
  marginPct,
  setMarginPct,
  simulation,
  loading,
}: {
  breakEven: any;
  summary: Summary | null;
  marginPct: number;
  setMarginPct: (v: number) => void;
  simulation: any;
  loading: boolean;
}) {
  if (!breakEven) return null;

  const fixedCosts = summary?.totalFixedCostsAllocated || 0;
  const variableCosts = summary?.totalVariableCosts || 0;

  return (
    <div className="thresholds-container">
      <Card className="thresholds-overview">
        <div className="thresholds-header">
          <div>
            <h3 className="thresholds-title">
              Punto de Equilibrio
              <HelpTooltip termKey="breakeven" size="md" />
            </h3>
            <p className="thresholds-subtitle">¿Cuánto necesitás vender para no perder plata?</p>
          </div>
        </div>

        <div className="thresholds-grid">
          <div className="threshold-card">
            <span className="threshold-label">
              Precio mínimo por noche
              <HelpTooltip termKey="breakEvenPrice" size="sm" />
            </span>
            <span className="threshold-value">{formatCurrency(simulation?.breakEvenPrice || breakEven.breakEvenPrice)}</span>
            <p className="threshold-desc">Precio base para cubrir costos operativos sin margen de ganancia.</p>
          </div>

          <div className="threshold-card">
            <span className="threshold-label">
              Noches para cubrir gastos fijos
              <HelpTooltip termKey="fixedCosts" size="sm" />
            </span>
            <span className="threshold-value">{Math.ceil(breakEven.nightsNeededForBreakEven)}</span>
            <p className="threshold-desc">Noches mensuales que necesitás vender solo para pagar sueldos, alquiler y servicios.</p>
          </div>

          <div className="threshold-card">
            <span className="threshold-label">Noches vendidas en el período</span>
            <span className="threshold-value">{Math.ceil(breakEven.nightsSoldThisPeriod)}</span>
            <p className="threshold-desc">
              {breakEven.nightsGap >= 0
                ? `${Math.round(breakEven.nightsGap)} noches por encima del equilibrio.`
                : `${Math.round(Math.abs(breakEven.nightsGap))} noches por debajo del equilibrio.`}
            </p>
          </div>
        </div>
      </Card>

      <div className="thresholds-simulator">
        <Card className="sandbox-controls">
          <h3 className="sandbox-title">
            Simulador de precio mínimo
            <HelpTooltip
              title="¿Para qué sirve esto?"
              content="Te ayuda a estimar el precio mínimo por noche para alcanzar la ganancia que querés. Ajustá el porcentaje y te mostramos el valor sugerido."
              size="md"
            />
          </h3>
          <p className="sandbox-subtitle">Mové el porcentaje y evaluá el impacto en tu precio objetivo</p>

          <div className="sandbox-field">
            <div className="field-header">
              <label>
                ¿Cuánto querés ganar?
                <HelpTooltip termKey="margin" size="sm" />
              </label>
              <span className="field-value">{marginPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={marginPct}
              onChange={(e) => setMarginPct(parseInt(e.target.value))}
              className="sandbox-slider"
            />
            <div className="slider-labels">
              <span>0%</span>
              <span>75%</span>
              <span>150%</span>
            </div>
          </div>

          <div className="sandbox-info">
            <Info size={16} />
            <p>Este cálculo usa tu comisión promedio ({formatPercent((simulation?.avgCommissionRate || 0) * 100)}) y tus gastos actuales.</p>
          </div>
        </Card>

        <Card className={`sandbox-result ${loading ? styles.loading : ''}`}>
          <div className="result-header">
            <Target size={32} className="text-primary" />
            <div>
              <span className="result-label">Precio sugerido por noche</span>
              <h2 className="result-value">
                {loading ? '...' : formatCurrency(simulation?.minPrice || 0)}
              </h2>
            </div>
          </div>

          <div className="result-details">
            {/* Paso 1: Costo base operativo */}
            <div className="result-item">
              <span>Costo Base (Fijo + Variable)</span>
              <span>{formatCurrency(simulation?.components?.baseCostPerNight || 0)}</span>
            </div>
            
            {/* Paso 2: Precio de equilibrio (base para no perder) */}
            <div className="result-item highlight">
              <span>
                Precio de Equilibrio
                <HelpTooltip 
                  title="Precio de Equilibrio" 
                  content="Este es el precio MÍNIMO por noche que necesitás para no perder dinero, considerando las comisiones de los canales. Todo precio por debajo de esto genera pérdida."
                  size="sm"
                />
              </span>
              <span className="text-warning">{formatCurrency(simulation?.breakEvenPrice || 0)}</span>
            </div>
            
            {/* Paso 3: Margen adicional */}
            <div className="result-item">
              <span>+ Margen deseado ({marginPct}%)</span>
              <span className="text-success">+{formatCurrency(simulation?.components?.marginAmount || 0)}</span>
            </div>
          </div>

          {!simulation?.hasCostsConfigured && (
            <div className="sandbox-warning-box">
              <Info size={14} />
              <p>
                <strong>⚠️ Sin costos configurados:</strong> No tenés costos fijos ni variables registrados. 
                <Link to="/costos" style={{ marginLeft: '4px', textDecoration: 'underline' }}>Configurá tus costos</Link> para ver el precio sugerido real.
              </p>
            </div>
          )}

          {simulation?.hasCostsConfigured && simulation?.totalNights < 5 && (
            <div className="sandbox-warning-box">
              <Info size={14} />
              <p>
                <strong>Atención:</strong> Tenés muy pocas noches vendidas ({simulation.totalNights}) en este periodo. 
                El cálculo es estable, pero recordá que necesitás más volumen para diluir realmente tus costos.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="thresholds-details">
        <h4>Desglose de Costos del Periodo</h4>
        <div className="thresholds-list">
          <div className="threshold-item">
            <span>Costos Fijos Prorrateados ({breakEven?.period?.days || 0} días)</span>
            <span>{formatCurrency(fixedCosts)}</span>
          </div>
          <div className="threshold-item">
            <span>Costos Variables Totales</span>
            <span>{formatCurrency(variableCosts)}</span>
          </div>
          <div className="threshold-item divider">
            <span>Costo Total a Cubrir</span>
            <span className="font-bold">{formatCurrency(fixedCosts + variableCosts)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// =====================================================
// Patterns View Component
// =====================================================

function PatternsView({ patterns }: { patterns: Pattern[] }) {
  const lossPatterns = patterns.filter((p) => p.isLossPattern).slice(0, 10);
  const profitPatterns = patterns.filter((p) => !p.isLossPattern).slice(0, 10);

  return (
    <div className="patterns-container">
      <Card className="patterns-section">
        <h3 className="patterns-title">🔴 Patrones de pérdida</h3>
        <p className="patterns-subtitle">Combinaciones de canal + estadía que generan pérdida</p>

        {lossPatterns.length > 0 ? (
          <div className="patterns-grid">
            {lossPatterns.map((p, i) => (
              <PatternCard key={i} pattern={p} variant="loss" />
            ))}
          </div>
        ) : (
          <p className="patterns-empty">🎉 ¡No hay patrones de pérdida!</p>
        )}
      </Card>

      <Card className="patterns-section">
        <h3 className="patterns-title">🟢 Patrones rentables</h3>
        <p className="patterns-subtitle">Tus mejores combinaciones</p>

        {profitPatterns.length > 0 ? (
          <div className="patterns-grid">
            {profitPatterns.map((p, i) => (
              <PatternCard key={i} pattern={p} variant="profit" />
            ))}
          </div>
        ) : (
          <p className="patterns-empty">No hay patrones rentables aún</p>
        )}
      </Card>
    </div>
  );
}

function PatternCard({ pattern, variant }: { pattern: Pattern; variant: 'loss' | 'profit' }) {
  return (
    <div className={`pattern-card pattern-card--${variant}`}>
      <div className="pattern-header">
        <span className="pattern-source">{pattern.source}</span>
        <span className="pattern-nights">
          {pattern.nightsBucket} noche{pattern.nightsBucket !== '1' ? 's' : ''}
        </span>
      </div>
      <div className="pattern-stats">
        <div className="pattern-stat">
          <span className="pattern-stat-value">{pattern.count}</span>
          <span className="pattern-stat-label">reservas</span>
        </div>
        <div className="pattern-stat">
          <span
            className={`pattern-stat-value ${variant === 'loss' ? 'text-error' : 'text-success'}`}
          >
            {variant === 'loss' ? '-' : ''}
            {formatCurrencyShort(variant === 'loss' ? pattern.lossAmount : pattern.totalProfit)}
          </span>
          <span className="pattern-stat-label">
            {variant === 'loss' ? 'pérdida total' : 'profit total'}
          </span>
        </div>
        <div className="pattern-stat">
          <span
            className={`pattern-stat-value ${variant === 'loss' ? 'text-error' : 'text-success'}`}
          >
            {formatCurrencyShort(pattern.avgProfitPerNight)}
          </span>
          <span className="pattern-stat-label">profit/noche</span>
        </div>
      </div>
    </div>
  );
}
