import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Upload,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  AlertTriangle,
  Info,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  getMonthlyCosts,
  getReservationEconomics,
  getBreakEven,
  getCosts,
  trackEvent,
  MonthlyCostEntry,
} from '../api';
import { formatMonth, generateMonthOptions, formatCurrencyShort, formatPercent } from '../utils/formatters';
import { HelpTooltip } from '../components';
import styles from './Costs.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EconomicsSummary {
  totalRevenue: number;
  totalCommissions: number;
  totalTaxes?: number;
  totalVariableCosts: number;
  totalFixedCostsAllocated: number;
  totalNetProfit: number;
  avgMarginPercent: number;
  totalRoomNights: number;
  avgProfitPerNight: number;
  goppar: number;
  configUsed?: {
    variableCostPerNight: number;
    monthlyFixedCosts: number;
    defaultCommissionRate: number;
  };
}

interface BreakEvenData {
  breakEvenPrice: number;
  nightsNeededForBreakEven: number;
  nightsSoldThisPeriod: number;
  nightsGap: number;
  breakEvenOccupancy?: number;
  currentOccupancy?: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  icon: 'commission' | 'fixed' | 'variable' | 'breakeven' | 'mom';
  link?: { to: string; label: string };
  variant: 'warning' | 'info' | 'success';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthRange(month: string): { start: string; end: string; days: number } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const days = end.getDate();
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    days,
  };
}

function getPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Costs() {
  const { property } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [hasTaxRules, setHasTaxRules] = useState<boolean | null>(null);
  const currentCurrency = property?.currency || 'ARS';
  const monthOptions = useMemo(() => generateMonthOptions(12, 1), []);

  const fmtCurrency = useCallback(
    (value: number) => {
      return new Intl.NumberFormat(currentCurrency === 'USD' ? 'en-US' : 'es-AR', {
        style: 'currency',
        currency: currentCurrency,
        maximumFractionDigits: 0,
      }).format(value);
    },
    [currentCurrency]
  );

  const { start, end } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);
  const { start: prevStart, end: prevEnd } = useMemo(() => getMonthRange(prevMonth), [prevMonth]);
  const enabled = !!property?.id;

  const { data: costsData, isLoading: costsLoading } = useApiQuery<any>(
    ['monthly-costs', property?.id, selectedMonth],
    () => getMonthlyCosts(property!.id, selectedMonth),
    { enabled }
  );
  const monthlyEntries: MonthlyCostEntry[] = costsData?.entries || [];
  const { data: economics, isLoading: econLoading } = useApiQuery<EconomicsSummary>(
    ['reservation-economics', property?.id, start, end],
    () => getReservationEconomics(property!.id, start, end),
    { enabled }
  );

  const { data: economicsPrev } = useApiQuery<EconomicsSummary>(
    ['reservation-economics', property?.id, prevStart, prevEnd],
    () => getReservationEconomics(property!.id, prevStart, prevEnd),
    { enabled }
  );

  const { data: breakEven } = useApiQuery<BreakEvenData>(
    ['breakeven', property?.id, start, end],
    () => getBreakEven(property!.id, start, end),
    { enabled }
  );

  const loading = costsLoading || econLoading;

  useEffect(() => {
    if (property?.id) trackEvent(property.id, 'view_costs');
  }, [property?.id]);

  useEffect(() => {
    let active = true;
    async function checkTaxRules() {
      if (!property?.id) return;
      const res = await getCosts(property.id);
      if (!active) return;
      setHasTaxRules(res.success && res.data?.tax_rules?.length > 0);
    }
    checkTaxRules();
    return () => { active = false; };
  }, [property?.id]);

  const monthlyTotalFixed = useMemo(
    () => monthlyEntries.filter((e) => e.costType === 'fixed').reduce((s, e) => s + (e.amount || 0), 0),
    [monthlyEntries]
  );
  const monthlyTotalVariable = useMemo(
    () => monthlyEntries.filter((e) => e.costType === 'variable').reduce((s, e) => s + (e.amount || 0), 0),
    [monthlyEntries]
  );
  const monthlyTotalCosts = monthlyTotalFixed + monthlyTotalVariable;

  const revenue = economics?.totalRevenue ?? 0;
  const commissions = economics?.totalCommissions ?? 0;
  const taxes = economics?.totalTaxes ?? 0;
  const variableCosts = economics?.totalVariableCosts ?? 0;
  const fixedCosts = economics?.totalFixedCostsAllocated ?? 0;
  const netProfit = economics?.totalNetProfit ?? 0;
  const roomNights = economics?.totalRoomNights ?? 0;
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const costPerNight = roomNights > 0 ? (variableCosts + fixedCosts) / roomNights : 0;
  const fixedShare = monthlyTotalCosts > 0 ? (monthlyTotalFixed / monthlyTotalCosts) * 100 : 0;
  const variableShare = monthlyTotalCosts > 0 ? (monthlyTotalVariable / monthlyTotalCosts) * 100 : 0;

  const hasRevenue = revenue > 0;
  const hasCosts = monthlyEntries.length > 0;
  const hasCostsOnly = hasCosts && !hasRevenue;

  const stackedData = useMemo(() => {
    if (!hasRevenue) return null;
    const total = commissions + taxes + variableCosts + fixedCosts + Math.max(0, netProfit);
    if (total === 0) return null;
    return {
      segments: [
        { key: 'commissions', label: 'Comisiones', value: commissions, pct: (commissions / revenue) * 100, color: '#f59e0b' },
        { key: 'taxes', label: 'Impuestos', value: taxes, pct: (taxes / revenue) * 100, color: '#a855f7' },
        { key: 'variable', label: 'Costos Var.', value: variableCosts, pct: (variableCosts / revenue) * 100, color: '#ef4444' },
        { key: 'fixed', label: 'Costos Fijos', value: fixedCosts, pct: (fixedCosts / revenue) * 100, color: '#dc2626' },
        { key: 'profit', label: 'Resultado', value: Math.max(0, netProfit), pct: Math.max(0, netProfit / revenue) * 100, color: '#22c55e' },
      ].filter(s => s.value > 0),
      revenue,
    };
  }, [revenue, commissions, taxes, variableCosts, fixedCosts, netProfit, hasRevenue]);

  const costBreakdown = useMemo(() => {
    const withAmount = monthlyEntries
      .filter((e) => (e.amount || 0) > 0)
      .sort((a, b) => b.amount - a.amount);
    if (withAmount.length === 0) return [];
    const total = withAmount.reduce((s, e) => s + e.amount, 0);
    return withAmount.map((e) => ({
      name: e.displayName || e.categoryKey,
      value: e.amount,
      pct: total > 0 ? (e.amount / total) * 100 : 0,
      type: e.costType,
    }));
  }, [monthlyEntries]);

  const recommendations = useMemo((): Recommendation[] => {
    const recs: Recommendation[] = [];
    const avgCommPct = revenue > 0 ? (commissions / revenue) * 100 : 0;
    if (avgCommPct > 15 && revenue > 0) {
      const saving10pp = revenue * 0.10;
      recs.push({
        id: 'commission',
        title: 'Comisiones altas',
        description: `Tu comisión promedio es ${avgCommPct.toFixed(0)}%. Mover 10pp a venta directa podría ahorrarte ~${formatCurrencyShort(saving10pp)}/mes.`,
        icon: 'commission',
        link: { to: '/canales', label: 'Ver Canales' },
        variant: 'warning',
      });
    }
    if (revenue > 0 && fixedCosts + variableCosts > 0) {
      const fixedPct = (fixedCosts / revenue) * 100;
      if (fixedPct > 50) {
        recs.push({
          id: 'fixed',
          title: 'Costos fijos elevados',
          description: `Tus costos fijos representan ${fixedPct.toFixed(0)}% del revenue. Revisá si podés optimizar estructura.`,
          icon: 'fixed',
          link: { to: '/importar?tab=costos', label: 'Editar costos' },
          variant: 'warning',
        });
      }
    }
    const hasVariableConfig = (economics?.configUsed?.variableCostPerNight ?? 0) > 0 || monthlyTotalVariable > 0;
    if (!hasVariableConfig && revenue > 0) {
      recs.push({
        id: 'variable',
        title: 'Sin costos variables',
        description: 'Sin costos variables configurados los márgenes pueden estar inflados. Cargá limpieza y amenities en Datos.',
        icon: 'variable',
        link: { to: '/importar?tab=costos', label: 'Ir a Datos' },
        variant: 'info',
      });
    }
    if (breakEven && roomNights > 0 && breakEven.nightsNeededForBreakEven > 0) {
      const gap = breakEven.nightsGap ?? 0;
      if (Math.abs(gap) <= 15) {
        recs.push({
          id: 'breakeven',
          title: 'Cerca del punto de equilibrio',
          description: `Estás a ${Math.abs(Math.round(gap))} noches del equilibrio. Revisá precios y ocupación en Rentabilidad.`,
          icon: 'breakeven',
          link: { to: '/rentabilidad', label: 'Rentabilidad' },
          variant: 'info',
        });
      }
    }
    if (economicsPrev && economicsPrev.totalRevenue > 0 && revenue > 0) {
      const prevTotalCosts = (economicsPrev.totalVariableCosts ?? 0) + (economicsPrev.totalFixedCostsAllocated ?? 0);
      const currTotalCosts = variableCosts + fixedCosts;
      const deltaPct = prevTotalCosts > 0 ? ((currTotalCosts - prevTotalCosts) / prevTotalCosts) * 100 : 0;
      if (deltaPct > 10) {
        recs.push({
          id: 'mom',
          title: 'Costos subieron vs mes anterior',
          description: `Los costos operativos subieron ${deltaPct.toFixed(0)}% respecto al mes anterior. Revisá el detalle por categoría.`,
          icon: 'mom',
          link: { to: '/importar?tab=costos', label: 'Ver costos' },
          variant: 'warning',
        });
      }
    }
    return recs.slice(0, 5);
  }, [
    revenue,
    commissions,
    variableCosts,
    fixedCosts,
    economics?.configUsed,
    monthlyTotalVariable,
    breakEven,
    roomNights,
    economicsPrev,
  ]);

  if (loading) {
    return (
      <div className={styles.costsPage}>
        <header className={styles.costsHeader}>
          <div className={styles.headerText}>
            <h1>Control Financiero</h1>
            <p>{formatMonth(selectedMonth)}</p>
          </div>
        </header>
        <div className={styles.costsLoading}>
          <div className={styles.spinner} />
          <p>Cargando control financiero...</p>
        </div>
      </div>
    );
  }

  const showFullPnL = hasRevenue || hasCosts;

  return (
    <div className={styles.costsPage}>
      <header className={styles.costsHeader}>
        <div className={styles.headerText}>
          <h1>Control Financiero</h1>
          <p>P&L y estructura de costos — {formatMonth(selectedMonth)}</p>
        </div>
        <div className={styles.headerActions}>
          {hasRevenue && (
            <div
              className={`${styles.marginChip} ${marginPct >= 0 ? styles.marginPositive : styles.marginNegative}`}
              title="Margen operativo"
            >
              Margen {formatPercent(marginPct, { decimals: 0 })}
            </div>
          )}
          <div className={styles.currencyBadge} title="Moneda">
            <DollarSign size={14} />
            <span>{currentCurrency}</span>
          </div>
          <Link to="/importar?tab=costos" className={styles.editCostsLink}>
            <Upload size={14} /> Editar en Datos
          </Link>
        </div>
      </header>

      <div className={styles.monthSelector}>
        <label htmlFor="costs-month-select">Período:</label>
        <select
          id="costs-month-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className={styles.monthSelect}
          aria-label="Seleccionar mes para el control financiero"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </div>

      {!showFullPnL ? (
        <div className={styles.monthlyEmptyState}>
          <div className={styles.monthlyEmptyIcon}>
            <BarChart3 size={32} />
          </div>
          <h3>No hay datos para {formatMonth(selectedMonth)}</h3>
          <p>Importá reportes de reservas y cargá costos en Datos para ver el P&L y el control financiero.</p>
          <Link to="/importar?tab=costos" className={styles.monthlyEmptyBtn}>
            <Upload size={16} /> Ir a Datos
          </Link>
        </div>
      ) : (
        <>
          {hasCostsOnly && (
            <div className={`${styles.dataBanner} ${styles.dataBannerInfo}`} role="alert">
              <Info size={20} aria-hidden />
              <div>
                <strong>Solo tenés costos cargados.</strong> Importá el reporte &quot;Reservations with Financials&quot; en Datos para ver el P&L completo (revenue, comisiones y resultado).
              </div>
            </div>
          )}

          {hasRevenue && hasTaxRules === false && (
            <div className={`${styles.dataBanner} ${styles.dataBannerWarning}`} role="alert">
              <AlertTriangle size={20} aria-hidden />
              <div>
                <strong>No tenés impuestos configurados.</strong> Sin IVA (21%) el P&L no refleja la carga fiscal real y el resultado está inflado.{' '}
                <Link to="/configuracion?tab=fiscal" style={{ fontWeight: 600 }}>Configurar en Ajustes → Fiscal</Link>{' '}
                o en{' '}
                <Link to="/importar?tab=costos" style={{ fontWeight: 600 }}>Datos → Costos</Link>.
              </div>
            </div>
          )}

          {/* P&L Statement */}
          <section className={styles.pnlSection} aria-labelledby="pnl-title">
            <h2 id="pnl-title" className={styles.sectionTitle}>Estado de resultados <HelpTooltip termKey="pnl" size="sm" /></h2>
            {hasRevenue ? (
              <div className={styles.pnlCard}>
                <PLLine
                  label="Revenue bruto"
                  value={revenue}
                  pct={100}
                  fmt={fmtCurrency}
                  isTotal
                  showPct
                  helpKey="revenue"
                />
                <PLLine
                  label="Comisiones OTAs"
                  value={-commissions}
                  pct={revenue > 0 ? (commissions / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  showPct={revenue > 0}
                  helpKey="commission"
                />
                <PLLine
                  label="Revenue neto"
                  value={revenue - commissions}
                  pct={revenue > 0 ? ((revenue - commissions) / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  isSubtotal
                  showPct={revenue > 0}
                />
                <PLLine
                  label="Impuestos incl. en tarifa"
                  value={-taxes}
                  pct={revenue > 0 ? (taxes / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  showPct={revenue > 0}
                  helpKey="taxes"
                  warning={taxes === 0 && hasTaxRules === false}
                  warningLink="/configuracion?tab=fiscal"
                  warningText="Sin IVA configurado"
                />
                <PLLine
                  label="Costos variables"
                  value={-variableCosts}
                  pct={revenue > 0 ? (variableCosts / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  showPct={revenue > 0}
                  helpKey="variableCosts"
                />
                <PLLine
                  label="Costos fijos"
                  value={-fixedCosts}
                  pct={revenue > 0 ? (fixedCosts / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  showPct={revenue > 0}
                  helpKey="fixedCosts"
                />
                <PLLine
                  label="Resultado operativo"
                  value={netProfit}
                  pct={revenue > 0 ? (netProfit / revenue) * 100 : 0}
                  fmt={fmtCurrency}
                  isResult
                  positive={netProfit >= 0}
                  showPct={revenue > 0}
                  helpKey="netProfit"
                />
              </div>
            ) : (
              <div className={styles.pnlCard}>
                <p className={styles.pnlNoRevenue}>
                  Sin datos de reservas no hay revenue ni comisiones. Los costos cargados para el mes se muestran abajo en el gráfico por categoría.
                </p>
                <Link to="/importar" className={styles.pnlCtaImport}>
                  <Upload size={16} /> Importar reportes en Datos
                </Link>
              </div>
            )}
          </section>

          {/* KPI Cards */}
          <section className={styles.kpiSection}>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Costo por noche ocupada <HelpTooltip termKey="cpor" size="sm" /></span>
                <span className={styles.kpiValue}>{roomNights > 0 ? fmtCurrency(costPerNight) : '—'}</span>
                {roomNights > 0 && <span className={styles.kpiMeta}>{roomNights} noches en el mes</span>}
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Margen operativo <HelpTooltip termKey="profitMargin" size="sm" /></span>
                <span className={`${styles.kpiValue} ${hasRevenue ? (marginPct >= 0 ? styles.positive : styles.negative) : ''}`}>
                  {hasRevenue ? formatPercent(marginPct, { decimals: 1 }) : '—'}
                </span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Break-even <HelpTooltip termKey="breakeven" size="sm" /></span>
                <span className={styles.kpiValue}>
                  {breakEven && breakEven.nightsNeededForBreakEven > 0
                    ? `${breakEven.nightsSoldThisPeriod} / ${breakEven.nightsNeededForBreakEven}`
                    : '—'}
                </span>
                {breakEven && breakEven.nightsNeededForBreakEven > 0 && (
                  <span className={styles.kpiMeta}>
                    noches vendidas / necesarias ({breakEven.nightsGap >= 0 ? `+${Math.round(breakEven.nightsGap)}` : Math.round(breakEven.nightsGap)})
                  </span>
                )}
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Ratio Fijos / Variables</span>
                <span className={styles.kpiValue}>
                  {monthlyTotalCosts > 0 ? `${Math.round(fixedShare)}% / ${Math.round(variableShare)}%` : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Charts */}
          <section className={styles.chartsSection}>
            <div className={styles.chartsGrid}>
              {stackedData && (
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>
                    <BarChart3 size={18} /> Distribución del revenue
                  </h3>
                  <p className={styles.chartNote}>Cada $ de revenue se reparte entre comisiones, costos y resultado</p>
                  <div className={styles.stackedBar}>
                    {stackedData.segments.map(seg => (
                      <div
                        key={seg.key}
                        className={styles.stackedSegment}
                        style={{ width: `${seg.pct}%`, background: seg.color }}
                        title={`${seg.label}: ${fmtCurrency(seg.value)} (${seg.pct.toFixed(0)}%)`}
                      />
                    ))}
                  </div>
                  <div className={styles.stackedLegend}>
                    {stackedData.segments.map(seg => (
                      <div key={seg.key} className={styles.stackedLegendItem}>
                        <span className={styles.stackedLegendColor} style={{ background: seg.color }} />
                        <span className={styles.stackedLegendLabel}>{seg.label}</span>
                        <span className={styles.stackedLegendValue}>{seg.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {costBreakdown.length > 0 && (
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>
                    <PieChartIcon size={18} /> Costos por categoría
                  </h3>
                  <p className={styles.chartNote}>Cargados para el mes en Datos</p>
                  <div className={styles.costBreakdownList}>
                    {costBreakdown.map((item) => (
                      <div key={item.name} className={styles.costBreakdownRow}>
                        <div className={styles.costBreakdownInfo}>
                          <span className={styles.costBreakdownName}>{item.name}</span>
                          <span className={styles.costBreakdownType}>
                            {item.type === 'fixed' ? 'Fijo' : 'Variable'}
                          </span>
                        </div>
                        <div className={styles.costBreakdownBarWrap}>
                          <div
                            className={`${styles.costBreakdownBar} ${item.type === 'fixed' ? styles.costBreakdownBarFixed : styles.costBreakdownBarVariable}`}
                            style={{ width: `${Math.max(2, item.pct)}%` }}
                          />
                        </div>
                        <div className={styles.costBreakdownValues}>
                          <span className={styles.costBreakdownAmount}>{fmtCurrency(item.value)}</span>
                          <span className={styles.costBreakdownPct}>{item.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* MoM */}
          {economics && economicsPrev && (economics.totalRevenue > 0 || economicsPrev.totalRevenue > 0) && (
            <section className={styles.momSection}>
              <h2 className={styles.sectionTitle}>Comparativa mes anterior</h2>
              <div className={styles.momGrid}>
                <div className={styles.momCard}>
                  <span className={styles.momLabel}>{formatMonth(getPreviousMonth(selectedMonth))}</span>
                  <span className={styles.momRevenue}>{fmtCurrency(economicsPrev.totalRevenue || 0)}</span>
                  <span className={styles.momProfit}>
                    {fmtCurrency(economicsPrev.totalNetProfit ?? 0)}
                    <span className={styles.momProfitLabel}> resultado</span>
                  </span>
                </div>
                <div className={styles.momArrow}>
                  <ArrowRight size={24} className={styles.momArrowIcon} />
                  <MoMDeltas
                    revenueCurr={revenue}
                    revenuePrev={economicsPrev.totalRevenue || 0}
                    profitCurr={netProfit}
                    profitPrev={economicsPrev.totalNetProfit ?? 0}
                    fmt={fmtCurrency}
                  />
                </div>
                <div className={styles.momCard}>
                  <span className={styles.momLabel}>{formatMonth(selectedMonth)}</span>
                  <span className={styles.momRevenue}>{fmtCurrency(revenue)}</span>
                  <span className={`${styles.momProfit} ${netProfit >= 0 ? styles.positive : styles.negative}`}>
                    {fmtCurrency(netProfit)}
                    <span className={styles.momProfitLabel}> resultado</span>
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <section className={styles.recoSection}>
              <h2 className={styles.sectionTitle}>Recomendaciones</h2>
              <div className={styles.recoGrid}>
                {recommendations.map((r) => (
                  <div key={r.id} className={`${styles.recoCard} ${styles[`recoCard_${r.variant}`]}`}>
                    <div className={styles.recoIcon}>
                      {r.icon === 'commission' && <Target size={20} />}
                      {r.icon === 'fixed' && <AlertTriangle size={20} />}
                      {r.icon === 'variable' && <Info size={20} />}
                      {r.icon === 'breakeven' && <TrendingUp size={20} />}
                      {r.icon === 'mom' && <ArrowUp size={20} />}
                    </div>
                    <div className={styles.recoContent}>
                      <h4 className={styles.recoTitle}>{r.title}</h4>
                      <p className={styles.recoDesc}>{r.description}</p>
                      {r.link && (
                        <Link to={r.link.to} className={styles.recoLink}>
                          {r.link.label}
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.editHint}>
            <Link to="/importar?tab=costos">
              <Upload size={14} /> Editar costos en Datos
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function PLLine({
  label,
  value,
  pct,
  fmt,
  isTotal,
  isSubtotal,
  isResult,
  positive,
  showPct = true,
  helpKey,
  warning,
  warningLink,
  warningText,
}: {
  label: string;
  value: number;
  pct: number;
  fmt: (n: number) => string;
  isTotal?: boolean;
  isSubtotal?: boolean;
  isResult?: boolean;
  positive?: boolean;
  showPct?: boolean;
  helpKey?: string;
  warning?: boolean;
  warningLink?: string;
  warningText?: string;
}) {
  const barWidth = Math.min(100, Math.max(0, Math.abs(pct)));
  return (
    <div
      className={`${styles.pnlRow} ${isTotal ? styles.pnlRowTotal : ''} ${isSubtotal ? styles.pnlRowSubtotal : ''} ${isResult ? styles.pnlRowResult : ''} ${isResult && positive === false ? styles.pnlRowNegative : ''} ${warning ? styles.pnlRowWarning : ''}`}
    >
      <div className={styles.pnlLabel}>
        {label} {helpKey && <HelpTooltip termKey={helpKey} size="sm" />}
        {warning && warningLink && (
          <Link to={warningLink} className={styles.pnlWarningLink}>
            <AlertTriangle size={12} /> {warningText || 'Configurar'}
          </Link>
        )}
      </div>
      <div className={styles.pnlBarWrap}>
        <div className={styles.pnlBar} style={{ width: `${barWidth}%` }} />
      </div>
      <div className={styles.pnlValue}>{fmt(value)}</div>
      {showPct && pct > 0 && (
        <div className={styles.pnlPct}>{pct.toFixed(0)}%</div>
      )}
    </div>
  );
}

function MoMDeltas({
  revenueCurr,
  revenuePrev,
  profitCurr,
  profitPrev,
  fmt,
}: {
  revenueCurr: number;
  revenuePrev: number;
  profitCurr: number;
  profitPrev: number;
  fmt: (n: number) => string;
}) {
  const revDelta = revenueCurr - revenuePrev;
  const profitDelta = profitCurr - profitPrev;
  const revZero = Math.abs(revDelta) < 1;
  const profitZero = Math.abs(profitDelta) < 1;
  return (
    <div className={styles.momDeltas}>
      <div className={styles.momDeltaRow}>
        <span>Revenue</span>
        {revZero ? (
          <span className={styles.deltaNeutral}>Sin cambio</span>
        ) : (
          <span className={revDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
            {revDelta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {fmt(Math.abs(revDelta))}
          </span>
        )}
      </div>
      <div className={styles.momDeltaRow}>
        <span>Resultado</span>
        {profitZero ? (
          <span className={styles.deltaNeutral}>Sin cambio</span>
        ) : (
          <span className={profitDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
            {profitDelta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {fmt(Math.abs(profitDelta))}
          </span>
        )}
      </div>
    </div>
  );
}
