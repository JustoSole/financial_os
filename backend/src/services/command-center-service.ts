import database from '../db';
import cacheService from './cache-service';
import { 
  calculateStructureMetrics, 
  calculateBreakEven,
  getARAging,
  calculateReconciliation,
  getCollectionsData,
  calculateMoMComparison,
  calculateYoYComparison,
} from './metrics-service';
import { calculateProfitabilityMetrics } from './calculators/profit-engine';
import { calculateMinimumPrice } from './calculators/pricing-engine';
import { 
  DEFAULT_CHANNEL_COMMISSIONS, 
  calculateTotalFixedCosts,
} from '../types';
import { getVariableCostPerNight } from './costs-utils';

// =====================================================
// Command Center Service
// Responde las 40 preguntas clave en un solo endpoint
// =====================================================

export interface BusinessHealthSnapshot {
  // Q1: ¿Estoy ganando o perdiendo dinero?
  netProfit: {
    value: number;
    isPositive: boolean;
    trend: 'up' | 'down' | 'stable';
    vsLastPeriod: number | null;
    vsLastPeriodPercent: number | null;
  };
  
  // Q2-3: Big 3 + GOPPAR
  kpis: {
    occupancy: { value: number; benchmark: string; status: 'good' | 'warning' | 'bad' };
    adr: { value: number; benchmark: string; status: 'good' | 'warning' | 'bad' };
    revpar: { value: number; benchmark: string; status: 'good' | 'warning' | 'bad' };
    goppar: { value: number; benchmark: string; status: 'good' | 'warning' | 'bad' };
  };
  
  // Q4: ¿Qué cambió vs el período anterior?
  changes: {
    driver: 'occupancy' | 'adr' | 'costs' | 'commissions' | null;
    explanation: string;
    impact: number;
  };
  
  // Q5: ¿Qué me debería preocupar HOY?
  topAlert: {
    type: 'cash_risk' | 'collections' | 'unprofitable' | 'breakeven' | 'data_quality' | null;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    actionLabel: string;
    actionLink: string;
  } | null;
}

export interface BreakEvenAnalysis {
  period?: { start: string; end: string; days: number };
  // Q6: Punto de equilibrio en ocupación
  breakEvenOccupancy: number;
  currentOccupancy: number;
  gapToBreakEven: number; // negative = below, positive = above
  
  // Q7: Noches necesarias para cubrir fijos
  nightsNeededForBreakEven: number;
  nightsSoldThisPeriod: number;
  nightsGap: number;
  
  // Q8: Tarifa mínima para no perder (break-even price)
  breakEvenPrice: number;
  currentAdr: number;
  
  // Q9: Tarifa para margen objetivo (simulación)
  marginSimulation: {
    margin10: number;
    margin20: number;
    margin30: number;
  };
  
  // Q10: ¿Qué tan lejos estoy del equilibrio?
  distanceToBreakEven: {
    inDollars: number;
    inNights: number;
    status: 'profitable' | 'at_risk' | 'losing';
  };
  
  // Q12: ¿Empeorando por precio o por ocupación?
  revparDecomposition: {
    occupancyContribution: number;
    adrContribution: number;
    primaryDriver: 'occupancy' | 'adr' | 'both';
  };
}

export interface UnitEconomics {
  // Q13: Profit por noche ocupada
  profitPerNight: number;
  
  // Q14: Margen de contribución por noche
  contributionMargin: number;
  contributionMarginPercent: number;
  
  // Q15: CPOR (Cost Per Occupied Room)
  cpor: number;
  cporBreakdown: {
    fixed: number;
    variable: number;
    commission: number;
  };
  
  // Q16: Mix fijo vs variable
  costMix: {
    fixedPercent: number;
    variablePercent: number;
    commissionPercent: number;
  };
  
  // Q17: ¿Qué costo se disparó?
  costAlerts: {
    category: string;
    trend: 'up' | 'stable';
    changePercent: number | null;
  }[];
}

export interface ChannelEconomics {
  // Q18-21: Mix de canales con profit real
  channels: {
    name: string;
    category: string;
    revenue: number;
    revenueShare: number;
    nights: number;
    nightsShare: number;
    commission: number;
    commissionRate: number;
    netRevenue: number;
    profitPerNight: number;
    isTopProfitPerNight: boolean;
    isWorstProfitPerNight: boolean;
  }[];
  
  // Q21: Canal con más profit por noche
  bestChannelByProfitPerNight: string;
  worstChannelByProfitPerNight: string;
  
  // Q22: Dependencia OTA
  otaDependency: {
    otaShare: number;
    directShare: number;
    isOverDependent: boolean; // >70% OTA
  };
  
  // Q23: Comisión promedio efectiva
  avgEffectiveCommission: number;
  
  // Q24: Canal "tóxico" (alto revenue, bajo margen)
  toxicChannel: {
    name: string;
    reason: string;
    potentialLoss: number;
  } | null;
}

export interface CashReconciliation {
  // Q25: Cobrado vs Cargado
  charged: number;
  collected: number;
  gap: number;
  gapExplanation: string;
  
  // Q26: Pendiente por cobrar
  totalPending: number;
  topPendingReservations: {
    reservationNumber: string;
    guestName: string;
    amount: number;
    checkIn: string;
    daysUntil: number;
  }[];
  
  // Q27: Aging del pendiente
  aging: {
    overdue: number;
    next7Days: number;
    next30Days: number;
    future: number;
  };
  
  // Q28: Runway operativo
  runwayDays: number;
  runwayStatus: 'safe' | 'warning' | 'danger';
  
  // Q29: Eventos que rompen caja
  cashBreakers: {
    refunds: number;
    voids: number;
    adjustments: number;
    total: number;
  };
}

export interface DataConfidence {
  // Q34: ¿Tengo data suficiente?
  score: number; // 0-100
  level: 'high' | 'medium' | 'low';
  
  // Q35: ¿Qué falta para HIGH confidence?
  missingForHighConfidence: string[];
  
  // Q36: Qué es real vs estimado
  realMetrics: string[];
  estimatedMetrics: string[];
  
  // Q37: Reportes faltantes
  missingReports: string[];

  // NUEVO: Cobertura histórica
  monthsCovered: number;
  earliestDate: string | null;
}

export interface CommandCenterData {
  period: { start: string; end: string; days: number };
  health: BusinessHealthSnapshot;
  breakeven: BreakEvenAnalysis;
  unitEconomics: UnitEconomics;
  channels: ChannelEconomics;
  cash: CashReconciliation;
  dataConfidence: DataConfidence;
  
  // NUEVO: Comparativas
  comparisons: {
    mom: {
      currentPeriod: string;      // "Enero 2026"
      previousPeriod: string;     // "Diciembre 2025"
      metrics: {
        revenue: { current: number; previous: number; changePercent: number };
        adr: { current: number; previous: number; changePercent: number };
        occupancy: { current: number; previous: number; changePercent: number };
        revpar: { current: number; previous: number; changePercent: number };
        netProfit: { current: number; previous: number; changePercent: number };
      };
    } | null;
    yoy: {
      currentPeriod: string;
      previousPeriod: string;
      metrics: {
        revenue: { current: number; previous: number; changePercent: number };
        adr: { current: number; previous: number; changePercent: number };
        occupancy: { current: number; previous: number; changePercent: number };
      };
    } | null;
  };

  // Q38-40: Acción principal de la semana
  weeklyAction: {
    title: string;
    impact: string;
    type: 'reduce_commission' | 'raise_adr' | 'cut_costs' | 'collect_pending' | 'improve_data';
    priority: 1 | 2 | 3;
  };
}

interface PeriodCostSnapshot {
  fixed: number;
  variable: number;
  commission: number;
  total: number;
  totalNights: number;
  totalReservations: number;
}

const DIRECT_SOURCES = [
  'direct',
  'directo',
  'walk-in',
  'email',
  'pagina web',
  'teléfono',
  'telefono',
  'website',
  'phone',
];

// =====================================================
// Main Function
// =====================================================

export function getCommandCenterData(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): CommandCenterData {
  const cacheKey = `command-center-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<CommandCenterData>(cacheKey);
  if (cached) return cached;

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

  const previousPeriod = getPreviousPeriodRange(startStr, days);

  // Get base data
  const costSettings = database.getCostSettings(propertyId);
  const dataHealth = database.getDataHealth(propertyId);
  const structure = calculateStructureMetrics(propertyId, startStr, endStr);
  const profitability = calculateProfitabilityMetrics(propertyId, startStr, endStr);
  const previousStructure = previousPeriod
    ? calculateStructureMetrics(propertyId, previousPeriod.start, previousPeriod.end)
    : null;
  const previousProfitability = previousPeriod
    ? calculateProfitabilityMetrics(propertyId, previousPeriod.start, previousPeriod.end)
    : null;
  const arAging = getARAging(propertyId);
  const reconciliation = calculateReconciliation(propertyId, startStr, endStr);
  const collections = getCollectionsData(propertyId);
  const currentCosts = getPeriodCosts(propertyId, startStr, endStr, days, costSettings);
  const previousCosts = previousPeriod
    ? getPeriodCosts(propertyId, previousPeriod.start, previousPeriod.end, days, costSettings)
    : null;

  // Calculate all sections
  const health = calculateBusinessHealth(
    propertyId,
    days,
    structure,
    profitability,
    dataHealth,
    collections,
    previousStructure,
    previousProfitability,
    currentCosts,
    previousCosts
  );
  const breakeven = calculateBreakEvenAnalysis(propertyId, days, structure, costSettings, previousStructure);
  const unitEconomics = calculateUnitEconomics(
    propertyId,
    days,
    structure,
    profitability,
    costSettings,
    currentCosts,
    previousCosts
  );
  const channels = calculateChannelEconomics(propertyId, days, costSettings, startStr, endStr);
  const cash = calculateCashReconciliation(propertyId, days, reconciliation, arAging, collections, costSettings);
  const dataConfidence = calculateDataConfidence(propertyId, dataHealth, costSettings);
  
  // Calculate comparisons
  const momData = calculateMoMComparison(propertyId, startStr, endStr);
  const yoyData = calculateYoYComparison(propertyId, startStr, endStr);

  const comparisons = {
    mom: momData ? {
      currentPeriod: 'Período actual',
      previousPeriod: 'Período anterior',
      metrics: {
        revenue: { current: momData.metrics.revenue.current, previous: momData.metrics.revenue.previous, changePercent: momData.metrics.revenue.changePercent },
        adr: { current: momData.metrics.adr.current, previous: momData.metrics.adr.previous, changePercent: momData.metrics.adr.changePercent },
        occupancy: { current: momData.metrics.occupancy.current, previous: momData.metrics.occupancy.previous, changePercent: momData.metrics.occupancy.changePercent },
        revpar: { 
          current: (momData.metrics.revenue.current / (costSettings?.room_count || 1) / days), 
          previous: (momData.metrics.revenue.previous / (costSettings?.room_count || 1) / days),
          changePercent: momData.metrics.revenue.changePercent // approximation
        },
        netProfit: { current: profitability.totalNetProfit, previous: 0, changePercent: 0 } // Historical profit is harder to get in one go
      }
    } : null,
    yoy: yoyData ? {
      currentPeriod: 'Este año',
      previousPeriod: 'Año anterior',
      metrics: {
        revenue: { current: yoyData.current.revenue, previous: yoyData.previousYear.revenue, changePercent: yoyData.deltas.revenuePercent },
        adr: { current: yoyData.current.adr, previous: yoyData.previousYear.adr, changePercent: yoyData.deltas.adrPercent },
        occupancy: { current: yoyData.current.occupancy, previous: yoyData.previousYear.occupancy, changePercent: yoyData.deltas.occupancyPercent },
      }
    } : null
  };

  const weeklyAction = determineWeeklyAction(health, breakeven, channels, cash, dataConfidence);

  const result: CommandCenterData = {
    period: { start: startStr, end: endStr, days },
    health,
    breakeven,
    unitEconomics,
    channels,
    cash,
    dataConfidence,
    comparisons,
    weeklyAction,
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Section Calculators
// =====================================================

function getPreviousPeriodRange(startStr: string, days: number) {
  const startDate = new Date(startStr);
  const prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const prevStartDate = new Date(prevEndDate.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: prevStartDate.toISOString().substring(0, 10),
    end: prevEndDate.toISOString().substring(0, 10),
  };
}

function normalizeSource(source: string): string {
  return (source || '').toLowerCase().trim();
}

function getCommissionRateForSource(source: string, costSettings: any): number {
  const normalized = normalizeSource(source);
  if (DIRECT_SOURCES.includes(normalized)) return 0;

  const overrides = costSettings?.channel_commissions?.byChannel || {};
  if (overrides[normalized] !== undefined) return overrides[normalized];
  if (overrides[source] !== undefined) return overrides[source];
  if (DEFAULT_CHANNEL_COMMISSIONS[normalized] !== undefined) return DEFAULT_CHANNEL_COMMISSIONS[normalized];
  return costSettings?.channel_commissions?.defaultRate || 0.15;
}

function getPeriodCosts(
  propertyId: string,
  startStr: string,
  endStr: string,
  days: number,
  costSettings: any
): PeriodCostSnapshot {
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const fixed = (fixedMonthly / 30.44) * days;

  const reservations = database.getReservationsByProperty(propertyId).filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const totalNights = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const { perNightBase, cleaningTotal } = getVariableCostPerNight(
    costSettings,
    totalNights,
    reservations.length
  );
  const variable = (totalNights * perNightBase) + cleaningTotal;

  const commission = reservations.reduce((sum, r) => {
    const revenue = r.room_revenue_total || 0;
    const rate = getCommissionRateForSource(r.source || 'directo', costSettings);
    return sum + (revenue * rate);
  }, 0);

  return {
    fixed,
    variable,
    commission,
    total: fixed + variable + commission,
    totalNights,
    totalReservations: reservations.length,
  };
}

function buildCostAlerts(
  currentCosts: PeriodCostSnapshot | null,
  previousCosts: PeriodCostSnapshot | null
): UnitEconomics['costAlerts'] {
  if (!currentCosts || !previousCosts) return [];

  const entries = [
    { category: 'Costos fijos', current: currentCosts.fixed, previous: previousCosts.fixed },
    { category: 'Costos variables', current: currentCosts.variable, previous: previousCosts.variable },
    { category: 'Comisiones', current: currentCosts.commission, previous: previousCosts.commission },
  ];

  return entries
    .map((entry): UnitEconomics['costAlerts'][number] | null => {
      if (entry.previous <= 0) {
        if (entry.current <= 0) {
          return null;
        }
        return { 
          category: entry.category, 
          trend: 'up', 
          changePercent: null 
        };
      }
      const changePercent = ((entry.current - entry.previous) / entry.previous) * 100;
      const trend = changePercent > 5 ? 'up' : 'stable';
      return { 
        category: entry.category, 
        trend, 
        changePercent: Math.round(changePercent * 10) / 10 
      };
    })
    .filter((entry): entry is UnitEconomics['costAlerts'][number] => 
      entry !== null && entry.trend === 'up'
    );
}

function calculateRevparDecomposition(structure: any, previousStructure: any | null) {
  if (!previousStructure) {
    return {
      occupancyContribution: 0,
      adrContribution: 0,
      primaryDriver: 'both' as const,
    };
  }

  const prevOcc = previousStructure.occupancyRate || 0;
  const prevAdr = previousStructure.ADR || 0;
  const occDelta = (structure.occupancyRate || 0) - prevOcc;
  const adrDelta = (structure.ADR || 0) - prevAdr;

  const occupancyContribution = (occDelta / 100) * prevAdr;
  const adrContribution = (adrDelta * (prevOcc / 100));
  const primaryDriver = Math.abs(occupancyContribution) >= Math.abs(adrContribution) ? 'occupancy' : 'adr';

  return {
    occupancyContribution: Math.round(occupancyContribution * 10) / 10,
    adrContribution: Math.round(adrContribution * 10) / 10,
    primaryDriver: primaryDriver as 'occupancy' | 'adr',
  };
}

function calculateChangeDriver(
  structure: any,
  profitability: any,
  previousStructure: any | null,
  previousProfitability: any | null,
  currentCosts: PeriodCostSnapshot | null,
  previousCosts: PeriodCostSnapshot | null
): BusinessHealthSnapshot['changes'] {
  const hasPrev = previousStructure && previousProfitability && previousCosts && currentCosts;
  const hasPrevData = hasPrev && (
    previousProfitability.totalNightsSold > 0 || previousProfitability.totalRevenue > 0
  );
  if (!hasPrevData) {
    return {
      driver: null,
      explanation: 'Análisis de cambios requiere más datos históricos',
      impact: 0,
    };
  }

  const availableNights = (structure.roomCount || 0) * (structure.period?.days || 0);
  const prevOcc = previousStructure.occupancyRate || 0;
  const prevAdr = previousStructure.ADR || 0;
  const occDelta = (structure.occupancyRate || 0) - prevOcc;
  const adrDelta = (structure.ADR || 0) - prevAdr;
  const occupancyImpact = (occDelta / 100) * prevAdr * (availableNights || 0);
  const adrImpact = adrDelta * (prevOcc / 100) * (availableNights || 0);

  const costDelta = (currentCosts.fixed + currentCosts.variable) - (previousCosts.fixed + previousCosts.variable);
  const commissionDelta = currentCosts.commission - previousCosts.commission;

  const impacts = [
    { driver: 'occupancy' as const, impact: occupancyImpact },
    { driver: 'adr' as const, impact: adrImpact },
    { driver: 'costs' as const, impact: -costDelta },
    { driver: 'commissions' as const, impact: -commissionDelta },
  ];

  const top = impacts.reduce((best, item) => Math.abs(item.impact) > Math.abs(best.impact) ? item : best);

  let explanation = '';
  if (top.driver === 'occupancy') {
    explanation = `Ocupación ${occDelta >= 0 ? 'subió' : 'bajó'} ${Math.round(occDelta * 10) / 10} pp`;
  } else if (top.driver === 'adr') {
    explanation = `ADR ${adrDelta >= 0 ? 'subió' : 'bajó'} $${Math.round(Math.abs(adrDelta))}`;
  } else if (top.driver === 'costs') {
    explanation = `Costos ${costDelta >= 0 ? 'subieron' : 'bajaron'} ~$${Math.round(Math.abs(costDelta) / 1000)}K`;
  } else {
    explanation = `Comisiones ${commissionDelta >= 0 ? 'subieron' : 'bajaron'} ~$${Math.round(Math.abs(commissionDelta) / 1000)}K`;
  }

  return {
    driver: top.driver,
    explanation,
    impact: Math.round(top.impact),
  };
}

function calculateBusinessHealth(
  propertyId: string, 
  days: number,
  structure: any,
  profitability: any,
  dataHealth: any,
  collections: any,
  previousStructure: any | null,
  previousProfitability: any | null,
  currentCosts: PeriodCostSnapshot | null,
  previousCosts: PeriodCostSnapshot | null
): BusinessHealthSnapshot {
  const netProfit = profitability?.totalNetProfit || 0;
  const isPositive = netProfit >= 0;
  const hasPrevData = previousProfitability && (
    previousProfitability.totalNightsSold > 0 || previousProfitability.totalRevenue > 0
  );
  const prevNetProfit = hasPrevData ? previousProfitability.totalNetProfit : null;
  const vsLastPeriod = prevNetProfit !== null ? netProfit - prevNetProfit : null;
  const vsLastPeriodPercent = prevNetProfit && prevNetProfit !== 0
    ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
    : null;
  
  // Determine top alert
  let topAlert: BusinessHealthSnapshot['topAlert'] = null;
  
  // Priority 1: Data quality
  if (dataHealth.score < 50) {
    topAlert = {
      type: 'data_quality',
      title: 'Faltan datos críticos',
      description: `Score de datos: ${dataHealth.score}/100. ${dataHealth.issues[0] || 'Importá más reportes'}`,
      severity: 'critical',
      actionLabel: 'Importar datos',
      actionLink: '/importar',
    };
  }
  // Priority 2: Cash risk
  else if (collections.totalBalanceDue > profitability?.totalRevenue * 0.5) {
    topAlert = {
      type: 'collections',
      title: 'Cobranza crítica',
      description: `Tenés $${Math.round(collections.totalBalanceDue / 1000)}K pendientes de cobro`,
      severity: 'critical',
      actionLabel: 'Ver cobranzas',
      actionLink: '/acciones',
    };
  }
  // Priority 3: Unprofitable
  else if (profitability?.unprofitableCount > 3) {
    topAlert = {
      type: 'unprofitable',
      title: `${profitability.unprofitableCount} reservas dieron pérdida`,
      description: `Perdiste $${Math.round(Math.abs(profitability.unprofitableLoss) / 1000)}K en reservas no rentables`,
      severity: 'warning',
      actionLabel: 'Analizar',
      actionLink: '/rentabilidad',
    };
  }
  // Priority 4: Break-even
  else if (structure.occupancyRate < 40) {
    topAlert = {
      type: 'breakeven',
      title: 'Ocupación baja',
      description: `${structure.occupancyRate.toFixed(0)}% ocupación - podrías estar por debajo del punto de equilibrio`,
      severity: 'warning',
      actionLabel: 'Ver break-even',
      actionLink: '/rentabilidad',
    };
  }

  // Determine KPI status
  const getOccupancyStatus = (occ: number) => occ >= 70 ? 'good' : occ >= 50 ? 'warning' : 'bad';
  const getGopparStatus = (goppar: number) => goppar > 0 ? 'good' : goppar >= -5000 ? 'warning' : 'bad';

  return {
    netProfit: {
      value: netProfit,
      isPositive,
      trend: netProfit > 0 ? 'up' : netProfit < 0 ? 'down' : 'stable',
      vsLastPeriod,
      vsLastPeriodPercent: vsLastPeriodPercent !== null ? Math.round(vsLastPeriodPercent * 10) / 10 : null,
    },
    kpis: {
      occupancy: { 
        value: structure.occupancyRate, 
        benchmark: '70%+ ideal',
        status: getOccupancyStatus(structure.occupancyRate),
      },
      adr: { 
        value: structure.ADR, 
        benchmark: 'Depende de tu mercado',
        status: 'good', // Context-dependent
      },
      revpar: { 
        value: structure.RevPAR, 
        benchmark: 'Ocupación × ADR',
        status: getOccupancyStatus(structure.occupancyRate),
      },
      goppar: { 
        value: structure.GOPPAR, 
        benchmark: 'Positivo = rentable',
        status: getGopparStatus(structure.GOPPAR),
      },
    },
    changes: calculateChangeDriver(
      structure,
      profitability,
      previousStructure,
      previousProfitability,
      currentCosts,
      previousCosts
    ),
    topAlert,
  };
}

function calculateBreakEvenAnalysis(
  propertyId: string,
  days: number,
  structure: any,
  costSettings: any,
  previousStructure: any | null
): BreakEvenAnalysis {
  const roomCount = costSettings?.room_count || 1;
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const fixedDaily = fixedMonthly / 30.44;
  const periodFixed = fixedDaily * days;
  
  const reservations = structure.period
    ? database.getReservationsByProperty(propertyId).filter((r: any) => {
        if (r.status === 'Cancelled' || r.status === 'No Show') return false;
        const checkIn = r.check_in?.substring(0, 10);
        return checkIn >= structure.period.start && checkIn <= structure.period.end;
      })
    : [];
  const totalNightsSold = reservations.reduce((sum: number, r: any) => sum + (r.room_nights || 0), 0);
  const totalReservations = reservations.length;

  const { perNightTotal } = getVariableCostPerNight(costSettings, totalNightsSold, totalReservations);
  
  // Get commission rate
  const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;
  
  // Contribution margin per night
  const ADR = structure.ADR || 0;
  const netAdr = ADR * (1 - defaultRate);
  const contributionPerNight = netAdr - perNightTotal;
  
  // Break-even calculations
  let breakEvenNights = 0;
  let breakEvenOccupancy = 0;
  
  if (contributionPerNight > 0) {
    breakEvenNights = Math.ceil(periodFixed / contributionPerNight);
    const availableNights = roomCount * days;
    breakEvenOccupancy = availableNights > 0 ? (breakEvenNights / availableNights) * 100 : 0;
  } else {
    breakEvenNights = 999999;
    breakEvenOccupancy = 100;
  }
  
  // Break-even price (price needed at current occupancy to break even)
  const availableNights = roomCount * days;
  const currentNights = (structure.occupancyRate / 100) * availableNights;
  let breakEvenPrice = 0;
  if (currentNights > 0) {
    const totalCostsNeeded = periodFixed + (currentNights * perNightTotal);
    breakEvenPrice = totalCostsNeeded / currentNights / (1 - defaultRate);
  }
  
  // Margin simulation
  const priceFor10 = calculateMinimumPrice(propertyId, 10);
  const priceFor20 = calculateMinimumPrice(propertyId, 20);
  const priceFor30 = calculateMinimumPrice(propertyId, 30);
  
  // Distance to break-even
  const actualRevenue = totalNightsSold * ADR;
  const actualCosts = periodFixed + (totalNightsSold * perNightTotal) + (actualRevenue * defaultRate);
  const actualProfit = actualRevenue - actualCosts;
  
  const nightsGap = totalNightsSold - breakEvenNights;
  const dollarsGap = actualProfit;
  
  return {
    period: structure?.period,
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    currentOccupancy: structure.occupancyRate,
    gapToBreakEven: Math.round((structure.occupancyRate - breakEvenOccupancy) * 10) / 10,
    nightsNeededForBreakEven: breakEvenNights,
    nightsSoldThisPeriod: totalNightsSold,
    nightsGap,
    breakEvenPrice: Math.round(breakEvenPrice),
    currentAdr: structure.ADR,
    marginSimulation: {
      margin10: priceFor10.minPrice,
      margin20: priceFor20.minPrice,
      margin30: priceFor30.minPrice,
    },
    distanceToBreakEven: {
      inDollars: Math.round(dollarsGap),
      inNights: nightsGap,
      status: dollarsGap > 0 ? 'profitable' : dollarsGap > -50000 ? 'at_risk' : 'losing',
    },
    revparDecomposition: calculateRevparDecomposition(structure, previousStructure),
  };
}

function calculateUnitEconomics(
  propertyId: string,
  days: number,
  structure: any,
  profitability: any,
  costSettings: any,
  currentCosts: PeriodCostSnapshot | null,
  previousCosts: PeriodCostSnapshot | null
): UnitEconomics {
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;
  
  // Use profitability.totalNightsSold (from BreakEvenResult) instead of non-existent reservations array
  // IMPORTANT: Don't default to 1 if totalNightsSold is 0, as this causes incorrect calculations
  const totalNights = profitability?.totalNightsSold || 0;
  const totalRevenue = profitability?.totalRevenue || 0;
  
  // Get number of reservations from currentCosts if available, otherwise calculate from database
  // currentCosts should always be populated when this function is called, but we have a fallback
  let totalReservations = currentCosts?.totalReservations || 0;
  if (totalReservations === 0 && totalNights > 0) {
    // Fallback: get reservations from database (should rarely be needed)
    // We need the period dates, but they're not passed. Use profitability.period if available
    const period = profitability?.period;
    if (period?.start && period?.end) {
      const reservations = database.getReservationsByProperty(propertyId).filter(r => {
        if (r.status === 'Cancelled' || r.status === 'No Show') return false;
        const checkIn = r.check_in?.substring(0, 10);
        return checkIn && checkIn >= period.start && checkIn <= period.end;
      });
      totalReservations = reservations.length;
    }
  }
  
  // Calculate total commission more accurately using currentCosts if available
  // This uses per-channel commission rates, which is more accurate than a flat defaultRate
  const totalCommission = currentCosts?.commission || (totalRevenue * defaultRate);
  
  const { perNightBase, perNightTotal, cleaningTotal } = getVariableCostPerNight(
    costSettings,
    totalNights,
    totalReservations
  );
  const totalVariableCosts = (totalNights * perNightBase) + cleaningTotal;
  
  const periodFixed = (fixedMonthly / 30.44) * days;
  const fixedPerNight = totalNights > 0 ? periodFixed / totalNights : 0;
  
  const totalCosts = periodFixed + totalVariableCosts + totalCommission;
  const profitPerNight = totalNights > 0 ? (totalRevenue - totalCosts) / totalNights : 0;
  
  // Contribution margin = ADR net - Variable
  const ADR = structure.ADR || 0;
  const netAdr = ADR * (1 - defaultRate);
  const contributionMargin = netAdr - perNightTotal;
  const contributionMarginPercent = ADR > 0 ? (contributionMargin / ADR) * 100 : 0;
  
  // CPOR
  const cpor = totalNights > 0 ? totalCosts / totalNights : 0;
  
  // Cost mix
  const totalCostsForMix = periodFixed + totalVariableCosts + totalCommission;
  
  return {
    profitPerNight: Math.round(profitPerNight),
    contributionMargin: Math.round(contributionMargin),
    contributionMarginPercent: Math.round(contributionMarginPercent * 10) / 10,
    cpor: Math.round(cpor),
    cporBreakdown: {
      fixed: Math.round(fixedPerNight),
      variable: Math.round(perNightBase + (cleaningTotal / (totalNights || 1))),
      commission: Math.round(totalCommission / (totalNights || 1)),
    },
    costMix: {
      fixedPercent: totalCostsForMix > 0 ? Math.round((periodFixed / totalCostsForMix) * 100) : 0,
      variablePercent: totalCostsForMix > 0 ? Math.round((totalVariableCosts / totalCostsForMix) * 100) : 0,
      commissionPercent: totalCostsForMix > 0 ? Math.round((totalCommission / totalCostsForMix) * 100) : 0,
    },
    costAlerts: buildCostAlerts(currentCosts, previousCosts),
  };
}

function calculateChannelEconomics(
  propertyId: string,
  days: number,
  costSettings: any,
  startDateStr?: string,
  endDateStr?: string
): ChannelEconomics {
  let startStr: string;
  let endStr: string;

  if (startDateStr && endDateStr) {
    startStr = startDateStr;
    endStr = endDateStr;
  } else {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = startDate.toISOString().substring(0, 10);
    endStr = endDate.toISOString().substring(0, 10);
  }
  
  const channelData = database.getChannelSummaryFromReservations(propertyId, startStr, endStr);
  if (channelData.length === 0) {
    const staticData = database.getChannelSummary(propertyId);
    if (staticData.length > 0) {
      channelData.push(...staticData);
    }
  }
  
  const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;
  const overrides = costSettings?.channel_commissions?.byChannel || {};
  
  // Calculate profitability for each channel
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const periodFixed = (fixedMonthly / 30.44) * days;
  const reservations = database.getReservationsByProperty(propertyId).filter((r: any) => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    if (!checkIn) return false;
    return checkIn >= startStr && checkIn <= endStr;
  });
  const totalReservations = reservations.length;
  
  const totalRevenue = channelData.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const totalNights = channelData.reduce((sum, c) => sum + c.room_nights, 0);
  const { perNightTotal } = getVariableCostPerNight(costSettings, totalNights, totalReservations);
  
  const directSources = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'];
  
  const channels = channelData.map(ch => {
    const name = ch.source;
    const nameLower = name.toLowerCase();
    const isDirect = directSources.includes(nameLower) || ch.source_category?.toLowerCase() === 'direct';
    const commissionRate = isDirect ? 0 : (overrides[nameLower] || DEFAULT_CHANNEL_COMMISSIONS[nameLower] || defaultRate);
    
    const revenue = ch.room_revenue_total;
    const nights = ch.room_nights;
    const commission = revenue * commissionRate;
    const netRevenue = revenue - commission;
    
    // Allocate fixed costs proportionally
    const nightsShare = totalNights > 0 ? nights / totalNights : 0;
    const allocatedFixed = periodFixed * nightsShare;
    const totalVariable = nights * perNightTotal;
    
    const channelProfit = netRevenue - allocatedFixed - totalVariable;
    const profitPerNight = nights > 0 ? channelProfit / nights : 0;
    
    return {
      name,
      category: ch.source_category || (isDirect ? 'Direct' : 'OTA'),
      revenue,
      revenueShare: totalRevenue > 0 ? revenue / totalRevenue : 0,
      nights,
      nightsShare,
      commission: Math.round(commission),
      commissionRate,
      netRevenue: Math.round(netRevenue),
      profitPerNight: Math.round(profitPerNight),
      isTopProfitPerNight: false,
      isWorstProfitPerNight: false,
    };
  });
  
  // Mark best and worst by profit per night (min 5% share)
  const significantChannels = channels.filter(c => c.revenueShare > 0.05 && c.nights > 0);
  const sortedByProfit = [...significantChannels].sort((a, b) => b.profitPerNight - a.profitPerNight);
  
  if (sortedByProfit.length > 0) {
    const best = sortedByProfit[0];
    const worst = sortedByProfit[sortedByProfit.length - 1];
    channels.find(c => c.name === best.name)!.isTopProfitPerNight = true;
    channels.find(c => c.name === worst.name)!.isWorstProfitPerNight = true;
  }
  
  // OTA dependency
  const otaRevenue = channels.filter(c => c.category === 'OTA').reduce((sum, c) => sum + c.revenue, 0);
  const directRevenue = channels.filter(c => c.category === 'Direct').reduce((sum, c) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? otaRevenue / totalRevenue : 0;
  const directShare = totalRevenue > 0 ? directRevenue / totalRevenue : 0;
  
  // Average commission
  const totalCommission = channels.reduce((sum, c) => sum + c.commission, 0);
  const avgCommission = totalRevenue > 0 ? totalCommission / totalRevenue : 0;
  
  // Find toxic channel (high revenue, low profit)
  let toxicChannel = null;
  const highRevenueChannels = channels.filter(c => c.revenueShare > 0.15 && c.profitPerNight < 0);
  if (highRevenueChannels.length > 0) {
    const toxic = highRevenueChannels[0];
    toxicChannel = {
      name: toxic.name,
      reason: `${(toxic.revenueShare * 100).toFixed(0)}% de tu revenue pero profit negativo`,
      potentialLoss: Math.abs(toxic.profitPerNight * toxic.nights),
    };
  }
  
  return {
    channels: channels.sort((a, b) => b.revenue - a.revenue),
    bestChannelByProfitPerNight: sortedByProfit[0]?.name || '-',
    worstChannelByProfitPerNight: sortedByProfit[sortedByProfit.length - 1]?.name || '-',
    otaDependency: {
      otaShare: Math.round(otaShare * 100),
      directShare: Math.round(directShare * 100),
      isOverDependent: otaShare > 0.7,
    },
    avgEffectiveCommission: Math.round(avgCommission * 1000) / 10,
    toxicChannel,
  };
}

function calculateCashReconciliation(
  propertyId: string,
  days: number,
  reconciliation: any,
  arAging: any,
  collections: any,
  costSettings: any
): CashReconciliation {
  const today = new Date();
  
  // Top pending reservations
  const topPending = collections.reservationsWithBalance
    .filter((r: any) => r.balanceDue > 5000)
    .slice(0, 5)
    .map((r: any) => {
      const checkIn = new Date(r.checkIn);
      const daysUntil = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        reservationNumber: r.reservationNumber,
        guestName: r.guestName || `Reserva ${r.reservationNumber}`,
        amount: r.balanceDue,
        checkIn: r.checkIn,
        daysUntil,
      };
    });
  
  // Runway calculation
  const startingBalance = costSettings?.starting_cash_balance || 0;
  const avgDailyNet = reconciliation.totalCredits - reconciliation.totalDebits;
  const avgDaily = days > 0 ? avgDailyNet / days : 0;
  
  let runwayDays = 999;
  if (avgDaily < 0 && startingBalance > 0) {
    runwayDays = Math.floor(startingBalance / Math.abs(avgDaily));
  }
  
  const runwayStatus = runwayDays > 60 ? 'safe' : runwayDays > 30 ? 'warning' : 'danger';
  
  // Cash breakers (from transactions)
  const transactions = database.getTransactionsByProperty(propertyId);
  const refunds = transactions.filter((t: any) => t.refund_flag).reduce((sum: any, t: any) => sum + Math.abs(t.credits || 0), 0);
  const voids = transactions.filter((t: any) => t.void_flag).reduce((sum: any, t: any) => sum + Math.abs(t.debits || 0), 0);
  const adjustments = transactions.filter((t: any) => t.adjustment_flag).reduce((sum: any, t: any) => sum + Math.abs(t.debits - t.credits || 0), 0);
  
  return {
    charged: reconciliation.totalDebits,
    collected: reconciliation.totalCredits,
    gap: reconciliation.gap,
    gapExplanation: reconciliation.explanation,
    totalPending: collections.totalBalanceDue,
    topPendingReservations: topPending,
    aging: {
      overdue: arAging.buckets.overdue,
      next7Days: arAging.buckets.next7,
      next30Days: arAging.buckets.next30,
      future: arAging.buckets.future,
    },
    runwayDays,
    runwayStatus,
    cashBreakers: {
      refunds,
      voids,
      adjustments,
      total: refunds + voids + adjustments,
    },
  };
}

function calculateDataConfidence(
  propertyId: string,
  dataHealth: any,
  costSettings: any
): DataConfidence {
  const missingForHigh: string[] = [];
  const missingReports: string[] = [];
  
  if (!dataHealth.hasExpandedTransactions) {
    missingForHigh.push('Importar Expanded Transaction Report');
    missingReports.push('Expanded Transaction Report with Details');
  }
  if (!dataHealth.hasReservationsFinancials) {
    missingForHigh.push('Importar Reservations with Financials');
    missingReports.push('Reservations with Financials');
  }
  if (!dataHealth.hasChannelPerformance) {
    missingReports.push('Channel Performance Summary (opcional)');
  }
  
  const roomCount = costSettings?.room_count || 0;
  if (roomCount === 0) {
    missingForHigh.push('Configurar cantidad de habitaciones');
  }
  
  const fixedTotal = costSettings?.fixed_costs ? calculateTotalFixedCosts(costSettings.fixed_costs) : 0;
  if (fixedTotal === 0) {
    missingForHigh.push('Configurar costos fijos mensuales');
  }
  
  const hasCommissions = costSettings?.channel_commissions?.byChannel && 
    Object.keys(costSettings.channel_commissions.byChannel).length > 0;
  if (!hasCommissions) {
    missingForHigh.push('Configurar comisiones por canal');
  }
  
  const level = dataHealth.score >= 80 ? 'high' : dataHealth.score >= 50 ? 'medium' : 'low';
  
  // Determine which metrics are real vs estimated
  const realMetrics = [];
  const estimatedMetrics = [];
  
  if (dataHealth.hasExpandedTransactions) {
    realMetrics.push('Cobrado', 'Cargado', 'Refunds', 'Ajustes');
  } else {
    estimatedMetrics.push('Cobrado', 'Cargado');
  }
  
  if (dataHealth.hasReservationsFinancials) {
    realMetrics.push('Revenue por reserva', 'Noches', 'Balance pendiente');
  } else {
    estimatedMetrics.push('Revenue', 'Noches', 'Pendiente');
  }
  
  estimatedMetrics.push('Comisiones', 'Profit neto', 'GOPPAR', 'Break-even');
  
  return {
    score: dataHealth.score,
    level,
    missingForHighConfidence: missingForHigh,
    realMetrics,
    estimatedMetrics,
    missingReports,
    monthsCovered: dataHealth.monthsCovered || 0,
    earliestDate: dataHealth.earliestDate || null,
  };
}

function determineWeeklyAction(
  health: BusinessHealthSnapshot,
  breakeven: BreakEvenAnalysis,
  channels: ChannelEconomics,
  cash: CashReconciliation,
  data: DataConfidence
): CommandCenterData['weeklyAction'] {
  // Priority 1: Data quality
  if (data.level === 'low') {
    return {
      title: 'Completar datos para análisis preciso',
      impact: 'Sin datos completos, todas las métricas son aproximaciones',
      type: 'improve_data',
      priority: 1,
    };
  }
  
  // Priority 2: Urgent collections
  if (cash.aging.overdue > 50000 || cash.aging.next7Days > 100000) {
    return {
      title: 'Cobrar pendientes urgentes',
      impact: `$${Math.round((cash.aging.overdue + cash.aging.next7Days) / 1000)}K en riesgo`,
      type: 'collect_pending',
      priority: 1,
    };
  }
  
  // Priority 3: Toxic channel
  if (channels.toxicChannel) {
    return {
      title: `Reducir dependencia de ${channels.toxicChannel.name}`,
      impact: `Evitar ~$${Math.round(channels.toxicChannel.potentialLoss / 1000)}K en pérdidas`,
      type: 'reduce_commission',
      priority: 2,
    };
  }
  
  // Priority 4: Below break-even
  if (breakeven.distanceToBreakEven.status === 'losing') {
    return {
      title: 'Subir tarifa mínima a punto de equilibrio',
      impact: `ADR actual $${breakeven.currentAdr} vs mínimo $${breakeven.breakEvenPrice}`,
      type: 'raise_adr',
      priority: 1,
    };
  }
  
  // Priority 5: High OTA dependency
  if (channels.otaDependency.isOverDependent) {
    return {
      title: 'Impulsar canal directo',
      impact: `${channels.otaDependency.otaShare}% OTA - comisión promedio ${channels.avgEffectiveCommission}%`,
      type: 'reduce_commission',
      priority: 2,
    };
  }
  
  // Default: maintain profitability
  return {
    title: 'Mantener ocupación y revisar costos',
    impact: 'Negocio estable, optimizar márgenes',
    type: 'cut_costs',
    priority: 3,
  };
}

export function getBreakEvenAnalysis(
  propertyId: string,
  startDateOrDays: string | number = 30,
  endDate?: string
): BreakEvenAnalysis {
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

  const costSettings = database.getCostSettings(propertyId);
  const structure = calculateStructureMetrics(propertyId, startStr, endStr);

  return calculateBreakEvenAnalysis(propertyId, days, structure, costSettings, null);
}

export default { getCommandCenterData };

