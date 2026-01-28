/**
 * =====================================================
 * Financial OS - Calculated Metrics Types
 * Types for computed/derived data from services
 * =====================================================
 */

import type { 
  TrustLevel, 
  ConfidenceLevel, 
  DataHealthLevel,
  KPIStatus,
  BreakEvenStatus,
  RunwayStatus,
  AlertSeverity,
  WeeklyActionType,
} from './enums';

// =====================================================
// Base Metric Types
// =====================================================

export interface DatePeriod {
  start: string;
  end: string;
  days: number;
}

export interface MetricTile {
  value: number;
  previousValue: number | null;
  delta: number | null;
  trust: TrustLevel;
  source: string;
  explainFormula: string;
}

// =====================================================
// Data Health
// =====================================================

export interface DataHealthScore {
  score: number;
  level: DataHealthLevel;
  issues: string[];
  lastImport: string | null;
  hasExpandedTransactions: boolean;
  hasReservationsFinancials: boolean;
  hasChannelPerformance?: boolean;
  monthsCovered?: number;
  earliestDate?: string | null;
  latestDate?: string | null;
  isUsingHistoricalData?: boolean;
  effectivePeriod?: DatePeriod | null;
  requestedPeriod?: DatePeriod | null;
}

// =====================================================
// Home Metrics (Dashboard)
// =====================================================

export interface ProjectionMetrics {
  projectedRevenue: number;
  projectedOccupancy: number;
  avgBookingWindow: number;
  totalOTB: number;
  estimatedMonthEnd: number;
}

export interface HomeMetrics {
  period: DatePeriod;
  cobrado: MetricTile;
  cargado: MetricTile;
  pendiente: MetricTile;
  ahorroPotencial: MetricTile & {
    topChannel?: string;
    suggestion?: string;
  };
  dataHealth: DataHealthScore;
  projections?: ProjectionMetrics;
}

// =====================================================
// Cash Metrics
// =====================================================

export interface DailyFlowItem {
  date: string;
  credits: number;
  debits: number;
  netFlow: number;
}

export interface CashAlert {
  type: 'refund' | 'void' | 'adjustment' | string;
  count: number;
  amount: number;
  description: string;
}

export interface CashMetrics {
  period: DatePeriod;
  runway: {
    days: number;
    trust: TrustLevel;
    startingBalance: number;
    avgNetDaily: number;
  };
  dailyFlow: DailyFlowItem[];
  alerts: CashAlert[];
}

// =====================================================
// Channel Metrics
// =====================================================

export interface ChannelData {
  source: string;
  sourceCategory: string;
  revenue: number;
  revenueShare: number;
  roomNights: number;
  estimatedCommission: number;
  effectiveCommissionRate: number;
  isCommissionEstimated: boolean;
  adr: number;
  adrNet: number;
  realCostPercent: number;
  avgLeadTime?: number;
  profitPerNight?: number;
}

export interface ChannelLeadTimePoint {
  leadTimeRange: string; // e.g. "0-7", "8-14", "15-30", "30+"
  avgProfitPerNight: number;
  reservationCount: number;
  revenue: number;
}

export interface ChannelInsights {
  bestChannel: { name: string; adrNet: number; reason?: string } | null;
  worstChannel: { name: string; adrNet: number; realCost?: string } | null;
  directAdr: number;
  leadTimeAnalysis?: {
    byChannel: Record<string, ChannelLeadTimePoint[]>;
    globalLeadTimeProfitability: ChannelLeadTimePoint[];
  };
}

export interface ChannelMetrics {
  period: Omit<DatePeriod, 'days'> & { days?: number };
  channels: ChannelData[];
  dependency: {
    topChannelCategory: string;
    sharePercent: number;
    isHighDependency: boolean;
  };
  savingsPotential: {
    value: number;
    description: string;
    trust: TrustLevel;
  };
  insights: ChannelInsights;
  dataSource?: 'reservations' | 'channel_summary';
}

// =====================================================
// Collections
// =====================================================

export interface CollectionReservation {
  reservationNumber: string;
  guestName: string | null;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  suggestedDeposit: number;
  depositGap: number;
}

export interface CollectionsData {
  totalBalanceDue: number;
  totalPaid?: number;
  reservationsWithBalance: CollectionReservation[];
}

// =====================================================
// Structure Metrics (KPIs)
// =====================================================

export interface StructureMetrics {
  period: DatePeriod;
  occupancyRate: number;
  ADR: number;
  RevPAR: number;
  NRevPAR: number;
  GOPPAR: number;
  roomCount: number;
  confidence: ConfidenceLevel;
}

// =====================================================
// Reconciliation
// =====================================================

export interface ReconciliationMetrics {
  period: Omit<DatePeriod, 'days'>;
  totalDebits: number;
  totalCredits: number;
  gap: number;
  explanation: string;
  status: 'balanced' | 'surplus' | 'deficit';
}

// =====================================================
// A/R Aging
// =====================================================

export interface ARAging {
  buckets: {
    overdue: number;
    next7: number;
    next30: number;
    future: number;
  };
  total: number;
  lastUpdate: string;
}

// =====================================================
// Revenue Projection
// =====================================================

export interface ProjectedReservation {
  reservationNumber: string;
  guestName: string;
  checkIn: string;
  source: string;
  revenue: number;
  paid: number;
  balance: number;
}

export interface ProjectedWeek {
  weekStart: string;
  weekEnd: string;
  confirmedNights: number;
  expectedRevenue: number;
  alreadyPaid: number;
  pendingPayment: number;
  paidPercent: number;
  reservations: ProjectedReservation[];
}

export interface ProjectionAlert {
  weekStart: string;
  message: string;
  severity: 'warning' | 'danger';
  amount: number;
}

export interface RevenueProjection {
  period: Omit<DatePeriod, 'days'>;
  weeks: ProjectedWeek[];
  totals: {
    confirmedNights: number;
    expectedRevenue: number;
    alreadyPaid: number;
    pendingPayment: number;
    paidPercent: number;
  };
  alerts: ProjectionAlert[];
}

// =====================================================
// Period Comparison
// =====================================================

export interface ComparisonMetric {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface PeriodComparison {
  current: {
    start: string;
    end: string;
    label: string;
  };
  previous: {
    start: string;
    end: string;
    label: string;
  };
  metrics: {
    revenue: ComparisonMetric;
    adr: ComparisonMetric;
    nights: ComparisonMetric;
    occupancy: ComparisonMetric;
    directShare: ComparisonMetric;
    otaShare: ComparisonMetric;
    commissions: ComparisonMetric;
  };
  insights: string[];
}

export interface YoYComparison {
  current: {
    label: string;
    revenue: number;
    adr: number;
    occupancy: number;
    nights: number;
  };
  previousYear: {
    label: string;
    revenue: number;
    adr: number;
    occupancy: number;
    nights: number;
  };
  deltas: {
    revenuePercent: number;
    adrPercent: number;
    occupancyPercent: number;
  };
}

// =====================================================
// Profitability / Reservation Economics
// =====================================================

export interface ReservationEconomics {
  reservationNumber: string;
  guestName: string;
  source: string;
  sourceCategory: string;
  checkIn: string;
  checkOut: string;
  status: string;
  roomNights: number;
  
  // Revenue
  revenue: number;
  
  // Costs breakdown
  commissionRate: number;
  commissionAmount: number;
  variableCosts: number;
  fixedCostAllocated: number;
  totalCosts: number;
  
  // P&L
  netProfit: number;
  profitPerNight: number;
  marginPercent: number;
  isUnprofitable: boolean;
  
  // Trust & Confidence
  trust: TrustLevel;
  confidence: ConfidenceLevel;
  confidenceReasons: string[];
  calcNotes: string[];
}

export interface ReservationPattern {
  source: string;
  nightsBucket: '1' | '2' | '3+';
  count: number;
  totalRevenue: number;
  totalProfit: number;
  avgProfitPerNight: number;
  isLossPattern: boolean;
  lossAmount: number;
}

export interface ReservationEconomicsSummary {
  period: DatePeriod;
  
  // Aggregates
  totalReservations: number;
  totalRoomNights: number;
  totalRevenue: number;
  totalCommissions: number;
  totalVariableCosts: number;
  totalFixedCostsAllocated: number;
  totalNetProfit: number;
  avgMarginPercent: number;
  avgProfitPerNight: number;
  
  // Unprofitable analysis
  unprofitableCount: number;
  unprofitableLoss: number;
  unprofitableShare: number;
  
  // GOPPAR
  goppar: number;
  
  // Patterns
  patterns: ReservationPattern[];
  
  // Best/Worst reservations
  worstReservations: ReservationEconomics[];
  bestReservations: ReservationEconomics[];
  
  // Data quality
  lowConfidenceCount: number;
  lowConfidenceShare: number;
  
  // Config used
  configUsed: {
    variableCostPerNight: number;
    cleaningCostPerStay: number;
    monthlyFixedCosts: number;
    defaultCommissionRate: number;
  };
}

// =====================================================
// Day of Week Performance
// =====================================================

export interface DOWPerformance {
  dayOfWeek: number; // 0-6 (Sun-Sat)
  dayLabel: string;
  roomNights: number;
  revenue: number;
  netProfit: number;
  profitPerNight: number;
  occupancyRate: number;
}

// =====================================================
// Trends
// =====================================================

export interface TrendPoint {
  month: string;
  value: number;
}

export interface TrendData {
  revenue: TrendPoint[];
  occupancy: TrendPoint[];
  adr: TrendPoint[];
  revpar: TrendPoint[];
  netProfit: TrendPoint[];
}

// =====================================================
// Command Center (Aggregated Dashboard Data)
// =====================================================

export interface BusinessHealthKPI {
  value: number;
  benchmark: string;
  status: KPIStatus;
}

export interface BusinessHealthSnapshot {
  netProfit: {
    value: number;
    isPositive: boolean;
    trend: 'up' | 'down' | 'stable';
    vsLastPeriod: number | null;
    vsLastPeriodPercent: number | null;
  };
  kpis: {
    occupancy: BusinessHealthKPI;
    adr: BusinessHealthKPI;
    revpar: BusinessHealthKPI;
    goppar: BusinessHealthKPI;
  };
  changes: {
    driver: 'occupancy' | 'adr' | 'costs' | 'commissions' | null;
    explanation: string;
    impact: number;
  };
  topAlert: {
    type: 'cash_risk' | 'collections' | 'unprofitable' | 'breakeven' | 'data_quality' | null;
    title: string;
    description: string;
    severity: AlertSeverity;
    actionLabel: string;
    actionLink: string;
  } | null;
}

export interface BreakEvenAnalysis {
  period?: { days: number };
  breakEvenOccupancy: number;
  currentOccupancy: number;
  gapToBreakEven: number;
  nightsNeededForBreakEven: number;
  nightsSoldThisPeriod: number;
  nightsGap: number;
  breakEvenPrice: number;
  currentAdr: number;
  marginSimulation: {
    margin10: number;
    margin20: number;
    margin30: number;
  };
  distanceToBreakEven: {
    inDollars: number;
    inNights: number;
    status: BreakEvenStatus;
  };
  revparDecomposition: {
    occupancyContribution: number;
    adrContribution: number;
    primaryDriver: 'occupancy' | 'adr' | 'both';
  };
}

export interface UnitEconomics {
  profitPerNight: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  cpor: number;
  cporBreakdown: {
    fixed: number;
    variable: number;
    commission: number;
  };
  costMix: {
    fixedPercent: number;
    variablePercent: number;
    commissionPercent: number;
  };
  costAlerts: {
    category: string;
    trend: 'up' | 'stable';
    changePercent: number | null;
  }[];
}

export interface ChannelEconomics {
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
  bestChannelByProfitPerNight: string;
  worstChannelByProfitPerNight: string;
  otaDependency: {
    otaShare: number;
    directShare: number;
    isOverDependent: boolean;
  };
  avgEffectiveCommission: number;
  toxicChannel: {
    name: string;
    reason: string;
    potentialLoss: number;
  } | null;
}

export interface CashReconciliation {
  charged: number;
  collected: number;
  gap: number;
  gapExplanation: string;
  totalPending: number;
  topPendingReservations: {
    reservationNumber: string;
    guestName: string;
    amount: number;
    checkIn: string;
    daysUntil: number;
  }[];
  aging: {
    overdue: number;
    next7Days: number;
    next30Days: number;
    future: number;
  };
  runwayDays: number;
  runwayStatus: RunwayStatus;
  cashBreakers: {
    refunds: number;
    voids: number;
    adjustments: number;
    total: number;
  };
}

export interface DataConfidence {
  score: number;
  level: ConfidenceLevel;
  missingForHighConfidence: string[];
  realMetrics: string[];
  estimatedMetrics: string[];
  missingReports: string[];
  monthsCovered: number;
  earliestDate: string | null;
}

export interface CommandCenterComparisons {
  mom: {
    currentPeriod: string;
    previousPeriod: string;
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
}

export interface WeeklyAction {
  title: string;
  impact: string;
  type: WeeklyActionType;
  priority: 1 | 2 | 3;
}

export interface CommandCenterData {
  period: DatePeriod;
  health: BusinessHealthSnapshot;
  structure: StructureMetrics;
  breakeven: BreakEvenAnalysis;
  unitEconomics: UnitEconomics;
  channels: ChannelEconomics;
  cash: CashReconciliation;
  dataConfidence: DataConfidence;
  comparisons: CommandCenterComparisons;
  weeklyAction: WeeklyAction;
  homeMetrics?: HomeMetrics;
}

