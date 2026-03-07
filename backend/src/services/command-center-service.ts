import database from '../db';
import cacheService from './cache-service';
import { CalculationEngine } from './calculation-engine';
import { 
  calculateReconciliation, 
  getARAging, 
  getCollectionsData,
  calculateChannelMetrics,
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
  DatePeriod,
  computeBreakEvenOccupancyPercent,
  DAYS_PER_MONTH,
  DEFAULT_ROOM_COUNT,
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

    const cacheKey = `command-center-${propertyId}-${startStr}-${endStr}`;
    const cached = cacheService.get<CommandCenterData>(cacheKey);
    if (cached) return cached;

    // Load shared data ONCE for all engines and services
    const [allReservations, costSettings, importFiles] = await Promise.all([
      database.getAllReservations(propertyId),
      database.getCostSettings(propertyId),
      database.getImportFiles(propertyId),
    ]);

    const sharedOpts = {
      preloadedReservations: allReservations,
      preloadedCostSettings: costSettings,
      preloadedImportFiles: importFiles,
    };

    const currentPeriod: DatePeriod = { start: startStr, end: endStr, days };
    const previousPeriodRange = getPreviousPeriodRange(startStr, days);

    // Initialize both engines in parallel with shared data (no extra DB calls)
    const engine = new CalculationEngine(propertyId, currentPeriod, sharedOpts);
    const prevEngine = new CalculationEngine(propertyId, { ...previousPeriodRange, days }, { ...sharedOpts, disableFallback: true });
    await Promise.all([engine.init(), prevEngine.init()]);

    // Parallel execution for remaining queries
    const [
      arAging,
      reconciliation,
      collections,
    ] = await Promise.all([
      getARAging(propertyId),
      calculateReconciliation(propertyId, startStr, endStr),
      getCollectionsData(propertyId),
    ]);

    const structure = engine.getStructureMetrics();
    const profitability = engine.getProfitability();
    const dataHealth = engine.getDataHealth();
    const prevStructure = prevEngine.getStructureMetrics();
    const prevProfitability = prevEngine.getProfitability();

    // Build MoM/YoY comparisons directly from engine data (no extra DB calls)
    const comparison = buildMoMFromEngines(structure, profitability, prevStructure, prevProfitability, currentPeriod, previousPeriodRange, days);
    const yoyComparison = null;

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

    const result: CommandCenterData = {
      period: currentPeriod,
      health,
      structure,
      breakeven,
      unitEconomics,
      channels,
      cash,
      dataConfidence,
      comparisons,
      weeklyAction,
      homeMetrics
    };
    cacheService.set(cacheKey, result);
    return result;
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
    period: { ...period, days: 30 },
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
    structure: {
      occupancyRate: 0,
      ADR: 0,
      RevPAR: 0,
      NRevPAR: 0,
      GOPPAR: 0,
      roomCount: 0,
      period: { start: '', end: '', days: 30 },
      confidence: 'low'
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
    } : null
  };
}

/**
 * Computes RevPAR decomposition: how much of RevPAR comes from occupancy vs ADR.
 * Uses the mathematical identity: RevPAR = Occupancy × ADR
 * The contribution is estimated from the relative magnitude of each factor.
 */
function computeRevparDecomposition(structure: any, _profitability: any, roomCount: number, days: number) {
  const occupancy = (structure.occupancyRate || 0) / 100;
  const adr = structure.ADR || 0;
  const revpar = structure.RevPAR || 0;

  if (revpar <= 0 || occupancy <= 0 || adr <= 0) {
    return { occupancyContribution: 0.5, adrContribution: 0.5, primaryDriver: 'both' as const };
  }

  const maxOccupancy = 1.0;
  const occHeadroom = maxOccupancy - occupancy;
  const occPotentialGain = occHeadroom * adr;
  const adrPotentialGain = occupancy * adr * 0.2;

  const total = occPotentialGain + adrPotentialGain;
  const occContrib = total > 0 ? occPotentialGain / total : 0.5;
  const adrContrib = total > 0 ? adrPotentialGain / total : 0.5;

  const primaryDriver: 'occupancy' | 'adr' | 'both' =
    Math.abs(occContrib - adrContrib) < 0.1 ? 'both' : occContrib > adrContrib ? 'occupancy' : 'adr';

  return {
    occupancyContribution: Math.round(occContrib * 100) / 100,
    adrContribution: Math.round(adrContrib * 100) / 100,
    primaryDriver,
  };
}

/**
 * Builder: Break-even
 * 
 * IMPORTANTE: Todos los cálculos de punto de equilibrio usan CAPACIDAD (no ocupación real)
 * para proporcionar referencias estables que no cambien según el volumen de ventas.
 */
function buildBreakEvenAnalysis(structure: any, profitability: any, settings: any, days: number): BreakEvenAnalysis {
  const fixedMonthly = (settings?.fixed_costs?.salaries || 0) + (settings?.fixed_costs?.rent || 0) + (settings?.fixed_costs?.utilities || 0) + (settings?.fixed_costs?.other || 0);
  const fixedPerDay = fixedMonthly / DAYS_PER_MONTH;
  const periodFixed = fixedPerDay * days;
  const roomCount = settings?.room_count || DEFAULT_ROOM_COUNT;
  const adr = structure.ADR || 0;
  
  // CAPACIDAD TOTAL - Base para todos los cálculos estables
  const totalCapacityNights = roomCount * days;
  
  // Noches vendidas (para información, no para cálculos de equilibrio)
  const nightsSold = (structure.occupancyRate * roomCount * days) / 100;
  
  // Costos variables basados en CAPACIDAD (no ocupación real)
  const { perNightTotal: variablePerNight } = getVariableCostPerNight(
    settings,
    totalCapacityNights, // Usar capacidad para consistencia
    Math.round(totalCapacityNights / 2.5)
  );
  
  // Tasa de comisión promedio desde datos reales
  const totalRevenue = profitability.totalRevenue || 0;
  const totalCommissions = profitability.totalCommissions || 0;
  const avgCommRate = totalRevenue > 0 ? totalCommissions / totalRevenue : (settings?.channel_commissions?.defaultRate || 0);
  
  // CONTRIBUCIÓN POR NOCHE = ADR neto (después de comisión) - costos variables
  const contribPerNight = (adr * (1 - avgCommRate)) - variablePerNight;

  // Fórmula centralizada (shared): (fixedPerDay / (contribPerNight * roomCount)) * 100
  const breakEvenOccupancy = computeBreakEvenOccupancyPercent(fixedPerDay, contribPerNight, roomCount);

  // NOCHES NECESARIAS para cubrir costos fijos del período
  const nightsNeeded = contribPerNight > 0 ? periodFixed / contribPerNight : totalCapacityNights;

  // PRECIO DE EQUILIBRIO - basado en CAPACIDAD (referencia estable)
  const fixedCostPerNight = totalCapacityNights > 0 ? periodFixed / totalCapacityNights : 0;
  const baseCostPerNight = fixedCostPerNight + variablePerNight;
  const breakEvenPrice = (1 - avgCommRate > 0)
    ? baseCostPerNight / (1 - avgCommRate)
    : 0;

  return {
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    currentOccupancy: structure.occupancyRate,
    gapToBreakEven: Math.round((structure.occupancyRate - breakEvenOccupancy) * 10) / 10,
    nightsNeededForBreakEven: Math.ceil(nightsNeeded),
    nightsSoldThisPeriod: Math.round(nightsSold),
    nightsGap: Math.round(nightsSold - nightsNeeded),
    breakEvenPrice: Math.round(breakEvenPrice),
    currentAdr: Math.round(adr),
    marginSimulation: {
      margin10: Math.round(breakEvenPrice / 0.9),  // 10% margen
      margin20: Math.round(breakEvenPrice / 0.8),  // 20% margen
      margin30: Math.round(breakEvenPrice / 0.7)   // 30% margen
    },
    distanceToBreakEven: {
      inDollars: Math.round((nightsSold - nightsNeeded) * contribPerNight),
      inNights: Math.round(nightsSold - nightsNeeded),
      status: nightsSold >= nightsNeeded ? 'profitable' : nightsSold >= nightsNeeded * 0.8 ? 'at_risk' : 'losing'
    },
    revparDecomposition: computeRevparDecomposition(structure, profitability, roomCount, days)
  };
}

/**
 * Builder: Unit Economics
 * 
 * IMPORTANTE: Los costos fijos por noche se calculan usando CAPACIDAD (no noches vendidas)
 * para ser consistentes con el cálculo del punto de equilibrio (breakEvenPrice).
 * Esto proporciona una referencia estable de "cuánto necesito por noche" que no cambia
 * según cuánto hayas vendido.
 */
function buildUnitEconomics(structure: any, profitability: any, settings: any, days: number): UnitEconomics {
  const roomCount = settings?.room_count || DEFAULT_ROOM_COUNT;
  const totalNights = (structure.occupancyRate * roomCount * days) / 100;
  
  // CAPACIDAD TOTAL - Base para costos fijos (consistente con breakEvenPrice)
  const totalCapacityNights = roomCount * days;
  
  // Use the same variable cost calculation as elsewhere, basado en capacidad para consistencia
  const { perNightTotal: variablePerNight } = getVariableCostPerNight(
    settings,
    totalCapacityNights, // Usar capacidad, no noches vendidas
    Math.round(totalCapacityNights / 2.5)
  );

  const adr = structure.ADR || 0;
  const netProfit = profitability.netProfit || 0;
  
  const profitPerNight = totalNights > 0 ? netProfit / totalNights : 0;
  
  // Fixed costs per night - BASADO EN CAPACIDAD (igual que breakEvenPrice)
  // Esto representa: "¿Cuánto me cuesta cada noche si vendo al 100%?"
  const fixedMonthly = (settings?.fixed_costs?.salaries || 0) + 
                       (settings?.fixed_costs?.rent || 0) + 
                       (settings?.fixed_costs?.utilities || 0) + 
                       (settings?.fixed_costs?.other || 0);
  const fixedPerDay = fixedMonthly / DAYS_PER_MONTH;
  const periodFixed = fixedPerDay * days;
  
  // Costo fijo por noche basado en CAPACIDAD para consistencia con breakEvenPrice
  const fixedPerNight = totalCapacityNights > 0 ? periodFixed / totalCapacityNights : 0;
  
  // Comisión promedio desde los datos reales
  const totalRevenue = profitability.totalRevenue || 0;
  const totalCommissions = profitability.totalCommissions || 0;
  const avgCommRate = totalRevenue > 0 ? totalCommissions / totalRevenue : 0;
  const commissionPerNight = adr * avgCommRate;

  return {
    profitPerNight: Math.round(profitPerNight),
    adr: Math.round(adr),
    contributionMargin: Math.round(adr - variablePerNight),
    contributionMarginPercent: adr > 0 ? Math.round(((adr - variablePerNight) / adr) * 100) : 0,
    cpor: Math.round(fixedPerNight + variablePerNight),
    cporBreakdown: {
      fixed: Math.round(fixedPerNight),
      variable: Math.round(variablePerNight),
      commission: Math.round(commissionPerNight)
    },
    costMix: {
      fixedPercent: (fixedPerNight + variablePerNight + commissionPerNight) > 0 
        ? Math.round((fixedPerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) 
        : 0,
      variablePercent: (fixedPerNight + variablePerNight + commissionPerNight) > 0 
        ? Math.round((variablePerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) 
        : 0,
      commissionPercent: (fixedPerNight + variablePerNight + commissionPerNight) > 0 
        ? Math.round((commissionPerNight / (fixedPerNight + variablePerNight + commissionPerNight)) * 100) 
        : 0
    },
    costAlerts: []
  };
}

/**
 * Builder: Channel Economics
 */
async function buildChannelEconomics(propertyId: string, start: string, end: string, settings: any): Promise<ChannelEconomics> {
  const channelMetrics = await calculateChannelMetrics(propertyId, start, end);
  const totalNightsAll = (channelMetrics.channels || []).reduce((s: number, c: any) => s + (c.roomNights || 0), 0);
  const channels = (channelMetrics.channels || []).map((c: any) => ({
    name: c.source,
    category: c.sourceCategory,
    revenue: c.revenue,
    revenueShare: c.revenueShare * 100,
    nights: c.roomNights,
    nightsShare: totalNightsAll > 0 ? (c.roomNights / totalNightsAll) * 100 : 0,
    commission: c.estimatedCommission,
    commissionRate: c.effectiveCommissionRate * 100,
    netRevenue: c.revenue - c.estimatedCommission,
    profitPerNight: c.profitPerNight ?? c.adrNet,
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
 * Build MoM comparison directly from pre-computed engine data (avoids extra DB queries)
 */
function buildMoMFromEngines(
  structure: any, profitability: any,
  prevStructure: any, prevProfitability: any,
  currentPeriod: DatePeriod, prevRange: { start: string; end: string },
  days: number
) {
  const pct = (curr: number, prev: number) => prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;
  return {
    current: { label: `${currentPeriod.start} → ${currentPeriod.end}` },
    previous: { label: `${prevRange.start} → ${prevRange.end}` },
    metrics: {
      revenue: {
        current: profitability.totalRevenue || 0,
        previous: prevProfitability.totalRevenue || 0,
        changePercent: pct(profitability.totalRevenue || 0, prevProfitability.totalRevenue || 0),
      },
      adr: {
        current: structure.ADR || 0,
        previous: prevStructure.ADR || 0,
        changePercent: pct(structure.ADR || 0, prevStructure.ADR || 0),
      },
      occupancy: {
        current: structure.occupancyRate || 0,
        previous: prevStructure.occupancyRate || 0,
        changePercent: pct(structure.occupancyRate || 0, prevStructure.occupancyRate || 0),
      },
    },
  };
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

// calculateChannelMetrics is imported from './metrics-service' at the top of this file

