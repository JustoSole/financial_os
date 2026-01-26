import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { 
  calculateStructureMetrics, 
  calculateReconciliation, 
  getARAging, 
  getCollectionsData,
  calculateRevenueProjection,
  calculateMoMComparison,
  calculateDOWPerformance,
  calculateYoYComparison
} from './metrics-service';
import { 
  CommandCenterData,
  BreakEvenAnalysis,
  UnitEconomics,
  StructureMetrics,
  CollectionsData,
  ARAging,
  ReconciliationMetrics,
  RevenueProjection,
  PeriodComparison,
  DOWPerformance,
  YoYComparison,
  BusinessHealthSnapshot,
  ChannelEconomics,
  CashReconciliation,
  DataConfidence,
  CommandCenterComparisons,
  WeeklyAction,
  DatePeriod
} from '../types';
import { getVariableCostPerNight } from './costs-utils';

/**
 * Command Center Service - Unified Strategic Dashboard
 * Responds to 40 key questions for hotel owners
 */
export async function getCommandCenterData(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<CommandCenterData> {
  try {
    let startStr: string;
    let endStr: string;
    let days: number;

    if (typeof startDateOrDays === 'string' && endDate) {
      startStr = startDateOrDays;
      endStr = endDate;
      const start = new Date(startStr);
      const end = new Date(endStr);
      days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      startStr = start.toISOString().substring(0, 10);
      endStr = end.toISOString().substring(0, 10);
    }

    const currentPeriod: DatePeriod = { start: startStr, end: endStr, days };
    const engine = new CalculationEngine(propertyId, currentPeriod);
    await engine.init();

    const previousPeriodRange = getPreviousPeriodRange(startStr, days);
    const prevEngine = new CalculationEngine(propertyId, { ...previousPeriodRange, days });
    await prevEngine.init();

    // Get base data with parallel execution for speed
    const [
      costSettings,
      arAging,
      reconciliation,
      collections,
      comparison,
      yoyComparison
    ] = await Promise.all([
      database.getCostSettings(propertyId),
      getARAging(propertyId),
      calculateReconciliation(propertyId, startStr, endStr),
      getCollectionsData(propertyId),
      calculateMoMComparison(propertyId, startStr, endStr),
      calculateYoYComparison(propertyId, startStr, endStr)
    ]);

    const structure = engine.getStructureMetrics();
    const profitability = engine.getProfitability();
    const dataHealth = engine.getDataHealth();
    const prevStructure = prevEngine.getStructureMetrics();
    const prevProfitability = prevEngine.getProfitability();

    // Calculate all sections using standardized builders
    const health = buildHealthSnapshot(structure, profitability, prevStructure, prevProfitability, dataHealth, collections);
    const breakeven = buildBreakEvenAnalysis(structure, profitability, costSettings, days);
    const unitEconomics = buildUnitEconomics(structure, profitability, costSettings, days);
    const channels = await buildChannelEconomics(propertyId, startStr, endStr, costSettings);
    const cash = buildCashReconciliation(reconciliation, collections, arAging, days);
    const dataConfidence = buildDataConfidence(dataHealth);
    const comparisons = buildComparisons(comparison, yoyComparison, profitability, prevProfitability);
    const weeklyAction = buildWeeklyAction(health, breakeven, channels);

    // Get Home Metrics (which now include projections)
    const homeMetrics = engine.getHomeMetrics();

    return {
      period: currentPeriod,
      health,
      breakeven,
      unitEconomics,
      channels,
      cash,
      dataConfidence,
      comparisons,
      weeklyAction,
      homeMetrics // New field
    };
  } catch (error) {
    console.error(`❌ Error building Command Center for ${propertyId}:`, error);
    return createEmptyCommandCenter(propertyId, startDateOrDays, endDate);
  }
}

/**
 * Helper: Create a safe empty structure for error cases
 */
function createEmptyCommandCenter(propertyId: string, startDateOrDays: any, endDate?: string): CommandCenterData {
  const period = { start: '', end: '', days: 30 };
  return {
    period,
    health: {
      netProfit: { value: 0, isPositive: false, trend: 'stable', vsLastPeriod: 0, vsLastPeriodPercent: 0 },
      kpis: {
        occupancy: { value: 0, benchmark: '0%', status: 'warning' },
        adr: { value: 0, benchmark: '$0', status: 'warning' },
        revpar: { value: 0, benchmark: '$0', status: 'warning' },
        goppar: { value: 0, benchmark: '$0', status: 'warning' }
      },
      changes: { driver: null, explanation: 'Sin datos', impact: 0 },
      topAlert: null
    },
    breakeven: {
      breakEvenOccupancy: 0, currentOccupancy: 0, gapToBreakEven: 0, nightsNeededForBreakEven: 0,
      nightsSoldThisPeriod: 0, nightsGap: 0, breakEvenPrice: 0, currentAdr: 0,
      marginSimulation: { margin10: 0, margin20: 0, margin30: 0 },
      distanceToBreakEven: { inDollars: 0, inNights: 0, status: 'at_risk' },
      revparDecomposition: { occupancyContribution: 0, adrContribution: 0, primaryDriver: 'both' }
    },
    unitEconomics: {
      profitPerNight: 0, contributionMargin: 0, contributionMarginPercent: 0, cpor: 0,
      cporBreakdown: { fixed: 0, variable: 0, commission: 0 },
      costMix: { fixedPercent: 0, variablePercent: 0, commissionPercent: 0 },
      costAlerts: []
    },
    channels: {
      channels: [], bestChannelByProfitPerNight: '-', worstChannelByProfitPerNight: '-',
      otaDependency: { otaShare: 0, directShare: 0, isOverDependent: false },
      avgEffectiveCommission: 0, toxicChannel: null
    },
    cash: {
      charged: 0, collected: 0, gap: 0, gapExplanation: 'Sin datos', totalPending: 0,
      topPendingReservations: [], aging: { overdue: 0, next7Days: 0, next30Days: 0, future: 0 },
      runwayDays: 0, runwayStatus: 'warning', cashBreakers: { refunds: 0, voids: 0, adjustments: 0, total: 0 }
    },
    dataConfidence: {
      score: 0, level: 'low', missingForHighConfidence: ['Sin datos'], realMetrics: [],
      estimatedMetrics: [], missingReports: [], monthsCovered: 0, earliestDate: null
    },
    comparisons: { mom: null, yoy: null },
    weeklyAction: { title: 'Importar datos', impact: 'Habilitar análisis', type: 'improve_data', priority: 1 }
  };
}

/**
 * Builder: Business Health
 */
function buildHealthSnapshot(
  structure: any, 
  profitability: any, 
  prevStructure: any, 
  prevProfitability: any, 
  dataHealth: any,
  collections: any
): BusinessHealthSnapshot {
  const netProfit = profitability.netProfit || 0;
  const prevNetProfit = prevProfitability?.netProfit || 0;
  const vsLastPeriod = netProfit - prevNetProfit;
  const vsLastPeriodPercent = prevNetProfit !== 0 ? (vsLastPeriod / Math.abs(prevNetProfit)) * 100 : 0;

  // Guard: Si no hay ocupación real, el profit es sospechoso
  // FIX: Considerar ocupación > 0 como dato real
  const hasRealData = structure.occupancyRate > 0 || structure.ADR > 0;

  // Calculate status based on occupancy
  let occupancyStatus: 'good' | 'warning' | 'bad' = 'bad';
  if (structure.occupancyRate >= 80) occupancyStatus = 'good';
  else if (structure.occupancyRate >= 50) occupancyStatus = 'warning';

  return {
    netProfit: {
      value: netProfit,
      isPositive: netProfit > 0,
      trend: vsLastPeriod > 0 ? 'up' : vsLastPeriod < 0 ? 'down' : 'stable',
      vsLastPeriod,
      vsLastPeriodPercent
    },
    kpis: {
      occupancy: { 
        value: structure.occupancyRate || 0, 
        benchmark: '-', 
        status: occupancyStatus
      },
      adr: { value: structure.ADR || 0, benchmark: '-', status: structure.ADR > 0 ? 'good' : 'bad' },
      revpar: { value: structure.RevPAR || 0, benchmark: '-', status: structure.RevPAR > 0 ? 'good' : 'bad' },
      goppar: { value: structure.GOPPAR || 0, benchmark: '-', status: structure.GOPPAR > 0 ? 'good' : 'bad' }
    },
    changes: {
      driver: vsLastPeriodPercent > 10 ? 'occupancy' : null,
      explanation: !hasRealData ? 'Sin datos suficientes' : (vsLastPeriod > 0 ? 'Mejora en rentabilidad' : 'Baja en rentabilidad'),
      impact: vsLastPeriod
    },
    topAlert: !hasRealData ? {
      type: 'data_quality',
      title: 'Faltan datos de operación',
      description: 'Importá tus reportes de Cloudbeds para ver métricas reales.',
      severity: 'critical',
      actionLabel: 'Importar ahora',
      actionLink: '/importar'
    } : (collections?.totalBalanceDue > 50000 ? {
      type: 'collections',
      title: 'Cobranzas Pendientes',
      description: `Tenés $${Math.round(collections.totalBalanceDue).toLocaleString()} por cobrar.`,
      severity: 'warning',
      actionLabel: 'Ver Cobranzas',
      actionLink: '/acciones'
    } : null)
  };
}

/**
 * Builder: Break-even
 */
function buildBreakEvenAnalysis(structure: any, profitability: any, settings: any, days: number): BreakEvenAnalysis {
  const fixedMonthly = (settings?.fixed_costs?.salaries || 0) + (settings?.fixed_costs?.rent || 0) + (settings?.fixed_costs?.utilities || 0) + (settings?.fixed_costs?.other || 0);
  const fixedPerDay = fixedMonthly / 30.44;
  const periodFixed = fixedPerDay * days;
  const roomCount = settings?.room_count || 1;
  const adr = structure.ADR || 0;
  
  // Get variable costs per night correctly
  const nightsSold = (structure.occupancyRate * roomCount * days) / 100;
  
  // Use the same variable cost calculation as elsewhere
  const { perNightTotal: variablePerNight } = getVariableCostPerNight(
    settings,
    nightsSold,
    0 
  );
  
  // Calculate average commission rate from actual profitability data
  const totalRevenue = profitability.totalRevenue || 0;
  const totalCommissions = profitability.totalCommissions || 0;
  const avgCommRate = totalRevenue > 0 ? totalCommissions / totalRevenue : (settings?.channel_commissions?.defaultRate || 0);
  
  // Contribution per night = ADR * (1 - commission%) - VariableCosts
  const contribPerNight = (adr * (1 - avgCommRate)) - variablePerNight;
  
  const breakEvenOccupancy = (contribPerNight > 0 && roomCount > 0)
    ? (fixedPerDay / (contribPerNight * roomCount)) * 100
    : 0;

  const nightsNeeded = contribPerNight > 0 ? periodFixed / contribPerNight : 0;

  return {
    breakEvenOccupancy: Math.round(breakEvenOccupancy),
    currentOccupancy: Math.round(structure.occupancyRate),
    gapToBreakEven: Math.round(structure.occupancyRate - breakEvenOccupancy),
    nightsNeededForBreakEven: Math.ceil(nightsNeeded),
    nightsSoldThisPeriod: Math.round(nightsSold),
    nightsGap: Math.round(nightsSold - nightsNeeded),
    breakEvenPrice: Math.round((periodFixed / (nightsSold || 1)) + variablePerNight + (adr * avgCommRate)),
    currentAdr: Math.round(adr),
    marginSimulation: {
      margin10: 0,
      margin20: 0,
      margin30: 0
    },
    distanceToBreakEven: {
      inDollars: Math.round((nightsSold - nightsNeeded) * contribPerNight),
      inNights: Math.round(nightsSold - nightsNeeded),
      status: nightsSold >= nightsNeeded ? 'profitable' : 'losing'
    },
    revparDecomposition: {
      occupancyContribution: 0.6,
      adrContribution: 0.4,
      primaryDriver: 'occupancy'
    }
  };
}

/**
 * Builder: Unit Economics
 */
function buildUnitEconomics(structure: any, profitability: any, settings: any, days: number): UnitEconomics {
  const roomCount = settings?.room_count || 1;
  const totalNights = (structure.occupancyRate * roomCount * days) / 100;
  
  // Use the same variable cost calculation as elsewhere
  const { perNightTotal: variablePerNight } = getVariableCostPerNight(
    settings,
    totalNights,
    0
  );

  const adr = structure.ADR || 0;
  const netProfit = profitability.netProfit || 0;
  
  const profitPerNight = totalNights > 0 ? netProfit / totalNights : 0;
  
  // Fixed costs per night
  const fixedMonthly = (settings?.fixed_costs?.salaries || 0) + 
                       (settings?.fixed_costs?.rent || 0) + 
                       (settings?.fixed_costs?.utilities || 0) + 
                       (settings?.fixed_costs?.other || 0);
  const fixedPerDay = fixedMonthly / 30.44;
  const fixedPerNight = totalNights > 0 ? (fixedPerDay * days) / totalNights : 0;
  
  const commissionPerNight = Math.max(0, adr - profitPerNight - fixedPerNight - variablePerNight);

  return {
    profitPerNight: Math.round(profitPerNight),
    contributionMargin: Math.round(adr - variablePerNight),
    contributionMarginPercent: adr > 0 ? Math.round(((adr - variablePerNight) / adr) * 100) : 0,
    cpor: totalNights > 0 ? Math.round(fixedPerNight + variablePerNight) : 0,
    cporBreakdown: {
      fixed: Math.round(fixedPerNight),
      variable: Math.round(variablePerNight),
      commission: Math.round(commissionPerNight)
    },
    costMix: {
      fixedPercent: totalNights > 0 ? Math.round((fixedPerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) : 0,
      variablePercent: totalNights > 0 ? Math.round((variablePerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) : 0,
      commissionPercent: totalNights > 0 ? Math.round((commissionPerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) : 0
    },
    costAlerts: []
  };
}

/**
 * Builder: Channel Economics
 */
async function buildChannelEconomics(propertyId: string, start: string, end: string, settings: any): Promise<ChannelEconomics> {
  const channelMetrics = await calculateChannelMetrics(propertyId, start, end);
  const channels = (channelMetrics.channels || []).map((c: any) => ({
    name: c.source,
    category: c.sourceCategory,
    revenue: c.revenue,
    revenueShare: c.revenueShare * 100,
    nights: c.roomNights,
    nightsShare: 0, // Calculate if needed
    commission: c.estimatedCommission,
    commissionRate: c.effectiveCommissionRate * 100,
    netRevenue: c.revenue - c.estimatedCommission,
    profitPerNight: c.adrNet, // Simplified
    isTopProfitPerNight: false,
    isWorstProfitPerNight: false
  }));

  return {
    channels,
    bestChannelByProfitPerNight: channelMetrics.insights?.bestChannel?.name || '-',
    worstChannelByProfitPerNight: channelMetrics.insights?.worstChannel?.name || '-',
    otaDependency: {
      otaShare: Math.round(channelMetrics.dependency?.sharePercent || 0),
      directShare: Math.round(100 - (channelMetrics.dependency?.sharePercent || 0)),
      isOverDependent: channelMetrics.dependency?.isHighDependency || false
    },
    avgEffectiveCommission: 0,
    toxicChannel: null
  };
}

/**
 * Builder: Cash Reconciliation
 */
function buildCashReconciliation(reconcile: any, collections: any, arAging: any, days: number): CashReconciliation {
  return {
    charged: reconcile.totalDebits,
    collected: reconcile.totalCredits,
    gap: reconcile.gap,
    gapExplanation: reconcile.explanation,
    totalPending: collections.totalBalanceDue,
    topPendingReservations: collections.reservationsWithBalance.slice(0, 5).map((r: any) => ({
      reservationNumber: r.reservationNumber,
      guestName: r.guestName,
      amount: r.balanceDue,
      checkIn: r.checkIn,
      daysUntil: 0
    })),
    aging: arAging.buckets,
    runwayDays: 0,
    runwayStatus: 'safe',
    cashBreakers: { refunds: 0, voids: 0, adjustments: 0, total: 0 }
  };
}

/**
 * Builder: Data Confidence
 */
function buildDataConfidence(dataHealth: any): DataConfidence {
  return {
    score: dataHealth.score,
    level: dataHealth.level === 'completos' ? 'high' : dataHealth.level === 'parciales' ? 'medium' : 'low',
    missingForHighConfidence: dataHealth.issues || [],
    realMetrics: [],
    estimatedMetrics: [],
    missingReports: [],
    monthsCovered: dataHealth.monthsCovered || 0,
    earliestDate: dataHealth.earliestDate
  };
}

/**
 * Builder: Comparisons
 */
function buildComparisons(mom: any, yoy: any, currentProfitability?: any, prevProfitability?: any): CommandCenterComparisons {
  const netProfitCurrent = currentProfitability?.netProfit || 0;
  const netProfitPrevious = prevProfitability?.netProfit || 0;
  const netProfitChange = netProfitCurrent - netProfitPrevious;
  const netProfitChangePercent = netProfitPrevious !== 0 ? (netProfitChange / Math.abs(netProfitPrevious)) * 100 : 0;

  return {
    mom: mom ? {
      currentPeriod: mom.current.label,
      previousPeriod: mom.previous.label,
      metrics: {
        revenue: { current: mom.metrics.revenue.current, previous: mom.metrics.revenue.previous, changePercent: mom.metrics.revenue.changePercent },
        adr: { current: mom.metrics.adr.current, previous: mom.metrics.adr.previous, changePercent: mom.metrics.adr.changePercent },
        occupancy: { current: mom.metrics.occupancy.current, previous: mom.metrics.occupancy.previous, changePercent: mom.metrics.occupancy.changePercent },
        revpar: { current: 0, previous: 0, changePercent: 0 }, 
        netProfit: { 
          current: Math.round(netProfitCurrent), 
          previous: Math.round(netProfitPrevious), 
          changePercent: netProfitChangePercent 
        }
      }
    } : null,
    yoy: yoy ? {
      currentPeriod: yoy.current.label,
      previousPeriod: yoy.previousYear.label,
      metrics: {
        revenue: { current: yoy.current.revenue, previous: yoy.previousYear.revenue, changePercent: yoy.deltas.revenuePercent },
        adr: { current: yoy.current.adr, previous: yoy.previousYear.adr, changePercent: yoy.deltas.adrPercent },
        occupancy: { current: yoy.current.occupancy, previous: yoy.previousYear.occupancy, changePercent: yoy.deltas.occupancyPercent }
      }
    } : null
  };
}

/**
 * Builder: Weekly Action
 */
function buildWeeklyAction(health: any, breakeven: any, channels: any): WeeklyAction {
  if (health.netProfit.value < 0) {
    return { title: 'Reducir Costos Fijos', impact: 'Frenar pérdida operativa', type: 'cut_costs', priority: 1 };
  }
  if (breakeven.gapToBreakEven < 0) {
    return { title: 'Impulsar Ocupación', impact: 'Llegar al punto de equilibrio', type: 'raise_adr', priority: 1 };
  }
  return { title: 'Optimizar Mix de Canales', impact: 'Mejorar margen neto', type: 'reduce_commission', priority: 2 };
}

/**
 * Helper: Get previous period range
 */
function getPreviousPeriodRange(currentStart: string, days: number): { start: string; end: string } {
  const start = new Date(currentStart);
  const end = new Date(start.getTime() - 1);
  const prevStart = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  
  return {
    start: prevStart.toISOString().substring(0, 10),
    end: end.toISOString().substring(0, 10)
  };
}

/**
 * Section 2: Break-even Analysis (Legacy Export)
 */
export async function getBreakEvenAnalysis(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
  const data = await getCommandCenterData(propertyId, startDateOrDays, endDate);
  return data.breakeven;
}

/**
 * Helper: Calculate channel metrics (internal)
 */
async function calculateChannelMetrics(propertyId: string, start: string, end: string): Promise<any> {
  // Use the existing one from metrics-service to avoid duplication
  const { calculateChannelMetrics: calc } = require('./metrics-service');
  return await calc(propertyId, start, end);
}

