import database from '../db';
import cacheService from './cache-service';
import {
  ReservationEconomics,
  ReservationEconomicsSummary,
  ReservationPattern,
  ConfidenceLevel,
  TrustLevel,
  DEFAULT_CHANNEL_COMMISSIONS,
  VariableCostsInput,
  FixedCostsInput,
  ChannelCommissions,
  PaymentFees,
  calculateTotalFixedCosts,
  calculateVariablePerNight,
} from '../types';

// =====================================================
// Reservation Economics Service
// Modelo matemático: NetProfit = Revenue - Commission - VariableCosts - FixedAllocated
// =====================================================

// Direct channel keywords (0% commission)
const DIRECT_SOURCES = [
  'direct', 'directo', 'walk-in', 'email', 'pagina web', 
  'teléfono', 'telefono', 'website', 'phone'
];

// Normalize source name for matching
function normalizeSource(source: string): string {
  return (source || '').toLowerCase().trim();
}

// Check if source is direct
function isDirectChannel(source: string): boolean {
  const normalized = normalizeSource(source);
  return DIRECT_SOURCES.some(d => normalized.includes(d));
}

// Categorize source
function categorizeSource(source: string): string {
  const normalized = normalizeSource(source);
  
  if (isDirectChannel(normalized)) return 'Direct';
  
  const otaSources = ['booking.com', 'booking', 'expedia', 'despegar', 'decolar', 
                      'airbnb', 'hotels.com', 'agoda', 'tripadvisor', 'kayak'];
  if (otaSources.some(ota => normalized.includes(ota))) return 'OTA';
  
  if (normalized.includes('agencia') || normalized.includes('viajes') || 
      normalized.includes('travel') || normalized.includes('agency')) {
    return 'Agencia de Viajes';
  }
  
  return 'Otro';
}

// Get commission rate for a source
function getCommissionRate(
  source: string,
  channelCommissions: ChannelCommissions
): { rate: number; isOverride: boolean; isDefault: boolean } {
  const normalized = normalizeSource(source);
  
  // Direct channels = 0%
  if (isDirectChannel(normalized)) {
    return { rate: 0, isOverride: false, isDefault: false };
  }
  
  // Check user overrides first
  if (channelCommissions.byChannel[normalized] !== undefined) {
    return { rate: channelCommissions.byChannel[normalized], isOverride: true, isDefault: false };
  }
  
  // Check against original source name (not normalized)
  if (channelCommissions.byChannel[source] !== undefined) {
    return { rate: channelCommissions.byChannel[source], isOverride: true, isDefault: false };
  }
  
  // Check system defaults
  if (DEFAULT_CHANNEL_COMMISSIONS[normalized] !== undefined) {
    return { rate: DEFAULT_CHANNEL_COMMISSIONS[normalized], isOverride: false, isDefault: false };
  }
  
  // Fallback to user's default OTA rate
  return { rate: channelCommissions.defaultRate, isOverride: false, isDefault: true };
}

// Get payment gateway fee
function getPaymentFee(
  paymentFees: PaymentFees,
  isHotelCollect: boolean,
  paymentMethod?: string
): { rate: number; applied: boolean } {
  // Only apply if hotel collects payment AND fees are enabled
  if (!isHotelCollect || !paymentFees.enabled) {
    return { rate: 0, applied: false };
  }
  
  // Check specific method
  if (paymentMethod && paymentFees.byMethod[paymentMethod] !== undefined) {
    return { rate: paymentFees.byMethod[paymentMethod], applied: true };
  }
  
  // Use default rate
  return { rate: paymentFees.defaultRate, applied: true };
}

// Determine confidence level for a reservation
function calculateConfidence(
  reservation: any,
  variableCosts: VariableCostsInput,
  fixedCosts: FixedCostsInput,
  variablePerNight: number,
  commissionInfo: { isOverride: boolean; isDefault: boolean }
): { confidence: ConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;
  
  // Check base fields
  if (!reservation.room_revenue_total || reservation.room_revenue_total <= 0) {
    score -= 40;
    reasons.push('Sin revenue registrado');
  }
  
  if (!reservation.room_nights || reservation.room_nights <= 0) {
    score -= 30;
    reasons.push('Sin noches registradas');
  }
  
  if (!reservation.source) {
    score -= 20;
    reasons.push('Canal desconocido');
  }
  
  // Check variable costs configuration
  const hasVariableCosts = variableCosts.cleaningPerStay > 0 || variablePerNight > 0;
  if (!hasVariableCosts) {
    score -= 15;
    reasons.push('Costos variables no configurados');
  }
  
  // Check fixed costs configuration
  const totalFixed = calculateTotalFixedCosts(fixedCosts);
  if (totalFixed === 0) {
    score -= 10;
    reasons.push('Costos fijos no configurados');
  }
  
  // Check commission resolution
  if (commissionInfo.isDefault) {
    score -= 10;
    reasons.push('Comisión estimada (default)');
  }
  
  // Determine level
  if (score >= 80) return { confidence: 'high', reasons: reasons.length === 0 ? ['Datos completos'] : reasons };
  if (score >= 50) return { confidence: 'medium', reasons };
  return { confidence: 'low', reasons };
}

// Calculate economics for a single reservation (V3 simplified)
function calculateReservationEconomics(
  reservation: any,
  variableCosts: VariableCostsInput,
  fixedCosts: FixedCostsInput,
  channelCommissions: ChannelCommissions,
  paymentFees: PaymentFees,
  variablePerNight: number,
  fixedCostPerNight: number
): ReservationEconomics {
  const source = reservation.source || 'Desconocido';
  const sourceCategory = categorizeSource(source);
  const roomNights = reservation.room_nights || 0;
  const revenue = reservation.room_revenue_total || 0;
  const isHotelCollect = reservation.hotel_collect_flag !== false; // Default true
  
  // Get channel commission
  const commissionInfo = getCommissionRate(source, channelCommissions);
  const commissionAmount = revenue * commissionInfo.rate;
  
  // Get payment gateway fee (only if hotel collects)
  const paymentFeeInfo = getPaymentFee(paymentFees, isHotelCollect);
  const paymentFeeAmount = revenue * paymentFeeInfo.rate;
  
  // Variable costs: cleaning per stay + calculated per-night costs
  const cleaningCost = variableCosts.cleaningPerStay || 0;
  const variableNightlyCost = variablePerNight * roomNights;
  const variableCostsTotal = cleaningCost + variableNightlyCost;
  
  // Fixed cost allocation (pro-rata by nights)
  const fixedCostAllocated = fixedCostPerNight * roomNights;
  
  // Total costs
  const totalCosts = commissionAmount + paymentFeeAmount + variableCostsTotal + fixedCostAllocated;
  
  // P&L
  const netProfit = revenue - totalCosts;
  const profitPerNight = roomNights > 0 ? netProfit / roomNights : 0;
  const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const isUnprofitable = netProfit < 0;
  
  // Confidence
  const { confidence, reasons } = calculateConfidence(
    reservation, variableCosts, fixedCosts, variablePerNight, commissionInfo
  );
  
  // Trust level
  let trust: TrustLevel = 'real';
  const hasVarConfig = cleaningCost > 0 || variablePerNight > 0;
  if (commissionInfo.isDefault || !hasVarConfig) {
    trust = 'estimado';
  }
  if (reasons.some(r => r.includes('Sin revenue') || r.includes('Sin noches'))) {
    trust = 'incompleto';
  }
  
  // Calc notes for transparency
  const calcNotes: string[] = [
    `Revenue: $${Math.round(revenue).toLocaleString()}`,
    `Comisión canal (${(commissionInfo.rate * 100).toFixed(0)}%): -$${Math.round(commissionAmount).toLocaleString()}`,
  ];
  
  if (paymentFeeInfo.applied) {
    calcNotes.push(`Fee pasarela (${(paymentFeeInfo.rate * 100).toFixed(1)}%): -$${Math.round(paymentFeeAmount).toLocaleString()}`);
  }
  
  if (cleaningCost > 0) {
    calcNotes.push(`Limpieza: -$${cleaningCost.toLocaleString()}`);
  }
  if (variablePerNight > 0) {
    calcNotes.push(`Variables (${roomNights}n × $${Math.round(variablePerNight)}): -$${Math.round(variableNightlyCost).toLocaleString()}`);
  }
  if (fixedCostAllocated > 0) {
    calcNotes.push(`Fijos prorrateados: -$${Math.round(fixedCostAllocated).toLocaleString()}`);
  }
  calcNotes.push(`═══════════════════════`);
  calcNotes.push(`Net Profit: $${Math.round(netProfit).toLocaleString()}`);
  
  return {
    reservationNumber: reservation.reservation_number,
    guestName: reservation.guest_name || 'Sin nombre',
    source,
    sourceCategory,
    checkIn: reservation.check_in,
    checkOut: reservation.check_out,
    status: reservation.status || 'Unknown',
    roomNights,
    revenue,
    commissionRate: commissionInfo.rate,
    commissionAmount: Math.round(commissionAmount),
    variableCosts: Math.round(variableCostsTotal),
    fixedCostAllocated: Math.round(fixedCostAllocated),
    totalCosts: Math.round(totalCosts),
    netProfit: Math.round(netProfit),
    profitPerNight: Math.round(profitPerNight),
    marginPercent: Math.round(marginPercent * 10) / 10,
    isUnprofitable,
    trust,
    confidence,
    confidenceReasons: reasons,
    calcNotes,
  };
}

// Get nights bucket for pattern analysis
function getNightsBucket(nights: number): '1' | '2' | '3+' {
  if (nights <= 1) return '1';
  if (nights === 2) return '2';
  return '3+';
}

// =====================================================
// Main Export: Calculate Reservation Economics Summary
// =====================================================

export function calculateReservationEconomicsSummary(
  propertyId: string,
  startDateOrDays: string | number = 30,
  endDate?: string
): ReservationEconomicsSummary {
  const cacheKey = `reservation-economics-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<ReservationEconomicsSummary>(cacheKey);
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

  // Get cost settings (V3 format)
  const costSettings = database.getCostSettings(propertyId);
  
  // Extract V3 cost components with minimal defaults
  const variableCosts: VariableCostsInput = costSettings?.variable_costs || {
    cleaningPerStay: 0,
    laundryMonthly: 0,
    amenitiesMonthly: 0,
  };
  const fixedCosts: FixedCostsInput = costSettings?.fixed_costs || {
    salaries: 0,
    rent: 0,
    utilities: 0,
    other: 0,
  };
  const channelCommissions: ChannelCommissions = costSettings?.channel_commissions || {
    defaultRate: 0.15,
    byChannel: {},
  };
  const paymentFees: PaymentFees = costSettings?.payment_fees || {
    enabled: false,
    defaultRate: 0.035,
    byMethod: {},
  };
  
  // Calculate total monthly fixed costs
  const monthlyFixedCosts = calculateTotalFixedCosts(fixedCosts);

  // Get reservations for period (by check_in date, exclude cancelled)
  const allReservations = database.getReservationsByProperty(propertyId);
  const reservations = allReservations.filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    if (!checkIn) return false;
    return checkIn >= startStr && checkIn <= endStr;
  });

  // Calculate total room nights for cost allocation
  const totalRoomNightsInPeriod = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);

  // Calculate variable cost per night from monthly totals
  const variablePerNight = calculateVariablePerNight(variableCosts, totalRoomNightsInPeriod);

  // Calculate fixed cost per night (prorate monthly to period, then divide by nights)
  const daysInMonth = 30.44;
  const fixedCostsPeriod = (monthlyFixedCosts / daysInMonth) * days;
  const fixedCostPerNight = totalRoomNightsInPeriod > 0 
    ? fixedCostsPeriod / totalRoomNightsInPeriod 
    : 0;

  // Calculate economics for each reservation using V3 structure
  const reservationEconomics: ReservationEconomics[] = reservations
    .filter(r => r.room_nights > 0)
    .map(r => calculateReservationEconomics(
      r,
      variableCosts,
      fixedCosts,
      channelCommissions,
      paymentFees,
      variablePerNight,
      fixedCostPerNight
    ));

  // Aggregates
  const totalReservations = reservationEconomics.length;
  const totalRoomNights = reservationEconomics.reduce((sum, r) => sum + r.roomNights, 0);
  const totalRevenue = reservationEconomics.reduce((sum, r) => sum + r.revenue, 0);
  const totalCommissions = reservationEconomics.reduce((sum, r) => sum + r.commissionAmount, 0);
  const totalVariableCosts = reservationEconomics.reduce((sum, r) => sum + r.variableCosts, 0);
  const totalFixedCostsAllocated = reservationEconomics.reduce((sum, r) => sum + r.fixedCostAllocated, 0);
  const totalNetProfit = reservationEconomics.reduce((sum, r) => sum + r.netProfit, 0);
  const avgMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
  const avgProfitPerNight = totalRoomNights > 0 ? totalNetProfit / totalRoomNights : 0;

  // Unprofitable analysis
  const unprofitable = reservationEconomics.filter(r => r.isUnprofitable);
  const unprofitableCount = unprofitable.length;
  const unprofitableLoss = Math.abs(unprofitable.reduce((sum, r) => sum + r.netProfit, 0));
  const unprofitableShare = totalReservations > 0 ? (unprofitableCount / totalReservations) * 100 : 0;

  // Pattern analysis (group by source + nights bucket)
  const patternMap: Record<string, {
    source: string;
    nightsBucket: '1' | '2' | '3+';
    count: number;
    totalRevenue: number;
    totalProfit: number;
    totalNights: number;
  }> = {};

  for (const r of reservationEconomics) {
    const bucket = getNightsBucket(r.roomNights);
    const key = `${r.source}|${bucket}`;
    
    if (!patternMap[key]) {
      patternMap[key] = {
        source: r.source,
        nightsBucket: bucket,
        count: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalNights: 0,
      };
    }
    
    patternMap[key].count++;
    patternMap[key].totalRevenue += r.revenue;
    patternMap[key].totalProfit += r.netProfit;
    patternMap[key].totalNights += r.roomNights;
  }

  const patterns: ReservationPattern[] = Object.values(patternMap)
    .map(p => ({
      source: p.source,
      nightsBucket: p.nightsBucket,
      count: p.count,
      totalRevenue: Math.round(p.totalRevenue),
      totalProfit: Math.round(p.totalProfit),
      avgProfitPerNight: p.totalNights > 0 ? Math.round(p.totalProfit / p.totalNights) : 0,
      isLossPattern: p.totalProfit < 0,
      lossAmount: p.totalProfit < 0 ? Math.abs(Math.round(p.totalProfit)) : 0,
    }))
    .sort((a, b) => a.totalProfit - b.totalProfit); // Worst patterns first

  // Worst reservations (top 10 losers)
  const worstReservations = [...reservationEconomics]
    .filter(r => r.isUnprofitable)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 10);

  // Best reservations (top 5 performers)
  const bestReservations = [...reservationEconomics]
    .sort((a, b) => b.profitPerNight - a.profitPerNight)
    .slice(0, 5);

  // Data quality
  const lowConfidence = reservationEconomics.filter(r => r.confidence === 'low');
  const lowConfidenceCount = lowConfidence.length;
  const lowConfidenceShare = totalReservations > 0 ? (lowConfidenceCount / totalReservations) * 100 : 0;

  const result: ReservationEconomicsSummary = {
    period: {
      start: startStr,
      end: endStr,
      days,
    },
    totalReservations,
    totalRoomNights,
    totalRevenue: Math.round(totalRevenue),
    totalCommissions: Math.round(totalCommissions),
    totalVariableCosts: Math.round(totalVariableCosts),
    totalFixedCostsAllocated: Math.round(totalFixedCostsAllocated),
    totalNetProfit: Math.round(totalNetProfit),
    avgMarginPercent: Math.round(avgMarginPercent * 10) / 10,
    avgProfitPerNight: Math.round(avgProfitPerNight),
    unprofitableCount,
    unprofitableLoss: Math.round(unprofitableLoss),
    unprofitableShare: Math.round(unprofitableShare * 10) / 10,
    patterns,
    worstReservations,
    bestReservations,
    lowConfidenceCount,
    lowConfidenceShare: Math.round(lowConfidenceShare * 10) / 10,
    configUsed: {
      variableCostPerNight: Math.round(variablePerNight),
      cleaningCostPerStay: variableCosts.cleaningPerStay,
      monthlyFixedCosts,
      defaultCommissionRate: channelCommissions.defaultRate,
    },
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Get All Reservation Economics (for table view)
// =====================================================

export function getReservationEconomicsList(
  propertyId: string,
  startDateOrDays: string | number = 30,
  endDateOrFilters?: string | {
    source?: string;
    nightsBucket?: '1' | '2' | '3+';
    unprofitableOnly?: boolean;
  },
  filters?: {
    source?: string;
    nightsBucket?: '1' | '2' | '3+';
    unprofitableOnly?: boolean;
  }
): ReservationEconomics[] {
  let startStr: string;
  let endStr: string;
  let days: number;
  let actualFilters = filters;

  if (typeof startDateOrDays === 'string' && typeof endDateOrFilters === 'string') {
    startStr = startDateOrDays;
    endStr = endDateOrFilters;
    const start = new Date(startStr);
    const end = new Date(endStr);
    days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
    actualFilters = endDateOrFilters as any;
  }

  const cacheKey = `reservation-economics-list-${propertyId}-${startStr}-${endStr}-${JSON.stringify(actualFilters || {})}`;
  const cached = cacheService.get<ReservationEconomics[]>(cacheKey);
  if (cached) return cached;

  // Get cost settings (V3 format)
  const costSettings = database.getCostSettings(propertyId);
  const variableCosts: VariableCostsInput = costSettings?.variable_costs || {
    cleaningPerStay: 0,
    laundryMonthly: 0,
    amenitiesMonthly: 0,
  };
  const fixedCosts: FixedCostsInput = costSettings?.fixed_costs || {
    salaries: 0,
    rent: 0,
    utilities: 0,
    other: 0,
  };
  const channelCommissions: ChannelCommissions = costSettings?.channel_commissions || {
    defaultRate: 0.15,
    byChannel: {},
  };
  const paymentFees: PaymentFees = costSettings?.payment_fees || {
    enabled: false,
    defaultRate: 0.035,
    byMethod: {},
  };
  const monthlyFixedCosts = calculateTotalFixedCosts(fixedCosts);

  // Get reservations for period
  const allReservations = database.getReservationsByProperty(propertyId);
  const reservations = allReservations.filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    if (!checkIn) return false;
    return checkIn >= startStr && checkIn <= endStr;
  });

  // Calculate totals for cost allocation
  const totalRoomNightsInPeriod = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const variablePerNight = calculateVariablePerNight(variableCosts, totalRoomNightsInPeriod);
  const daysInMonth = 30.44;
  const fixedCostsPeriod = (monthlyFixedCosts / daysInMonth) * days;
  const fixedCostPerNight = totalRoomNightsInPeriod > 0 
    ? fixedCostsPeriod / totalRoomNightsInPeriod 
    : 0;

  // Calculate economics for each using V3 structure
  let result = reservations
    .filter(r => r.room_nights > 0)
    .map(r => calculateReservationEconomics(
      r,
      variableCosts,
      fixedCosts,
      channelCommissions,
      paymentFees,
      variablePerNight,
      fixedCostPerNight
    ));

  // Apply filters
  if (actualFilters) {
    if (actualFilters.source) {
      result = result.filter(r => 
        normalizeSource(r.source) === normalizeSource(actualFilters!.source!)
      );
    }
    if (actualFilters.nightsBucket) {
      result = result.filter(r => 
        getNightsBucket(r.roomNights) === actualFilters!.nightsBucket
      );
    }
    if (actualFilters.unprofitableOnly) {
      result = result.filter(r => r.isUnprofitable);
    }
  }

  // Sort by profit per night (worst first)
  result.sort((a, b) => a.profitPerNight - b.profitPerNight);

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Get Single Reservation Economics (for drawer detail)
// =====================================================

export function getReservationEconomicsDetail(
  propertyId: string,
  reservationNumber: string
): ReservationEconomics | null {
  const allReservations = database.getReservationsByProperty(propertyId);
  const reservation = allReservations.find(r => r.reservation_number === reservationNumber);
  
  if (!reservation) return null;

  // Get cost settings (V3 format)
  const costSettings = database.getCostSettings(propertyId);
  const variableCosts: VariableCostsInput = costSettings?.variable_costs || {
    cleaningPerStay: 0,
    laundryMonthly: 0,
    amenitiesMonthly: 0,
  };
  const fixedCosts: FixedCostsInput = costSettings?.fixed_costs || {
    salaries: 0,
    rent: 0,
    utilities: 0,
    other: 0,
  };
  const channelCommissions: ChannelCommissions = costSettings?.channel_commissions || {
    defaultRate: 0.15,
    byChannel: {},
  };
  const paymentFees: PaymentFees = costSettings?.payment_fees || {
    enabled: false,
    defaultRate: 0.035,
    byMethod: {},
  };
  const monthlyFixedCosts = calculateTotalFixedCosts(fixedCosts);

  // Get recent occupancy for calculating per-night costs
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().substring(0, 10);
  const endStr = endDate.toISOString().substring(0, 10);
  
  const recentReservations = allReservations.filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    if (!checkIn) return false;
    return checkIn >= startStr && checkIn <= endStr;
  });
  
  const totalRoomNightsInPeriod = recentReservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const variablePerNight = calculateVariablePerNight(variableCosts, totalRoomNightsInPeriod);
  const fixedCostsPeriod = monthlyFixedCosts;
  const fixedCostPerNight = totalRoomNightsInPeriod > 0 
    ? fixedCostsPeriod / totalRoomNightsInPeriod 
    : 0;

  return calculateReservationEconomics(
    reservation,
    variableCosts,
    fixedCosts,
    channelCommissions,
    paymentFees,
    variablePerNight,
    fixedCostPerNight
  );
}

// =====================================================
// Helper: Get loss patterns for a channel
// =====================================================

export function getChannelLossPatterns(propertyId: string, days: number = 30) {
  const summary = calculateReservationEconomicsSummary(propertyId, days);
  
  return summary.patterns
    .filter(p => p.isLossPattern)
    .sort((a, b) => b.lossAmount - a.lossAmount);
}

// =====================================================
// Helper: Check if costs are properly configured
// =====================================================

export function checkCostsConfigured(propertyId: string): {
  isComplete: boolean;
  issues: string[];
  completionPercent: number;
} {
  const costSettings = database.getCostSettings(propertyId);
  const issues: string[] = [];
  let score = 0;
  const maxScore = 4;
  
  // Check variable costs (cleaning or monthly expenses)
  const variableCosts = costSettings?.variable_costs;
  const hasVariables = variableCosts && (
    variableCosts.cleaningPerStay > 0 || 
    variableCosts.laundryMonthly > 0 || 
    variableCosts.amenitiesMonthly > 0
  );
  if (hasVariables) {
    score++;
  } else {
    issues.push('Costos variables no configurados');
  }
  
  // Check fixed costs
  const fixedCosts = costSettings?.fixed_costs;
  const totalFixed = fixedCosts ? calculateTotalFixedCosts(fixedCosts) : 0;
  if (totalFixed > 0) {
    score++;
  } else {
    issues.push('Costos fijos mensuales no configurados');
  }
  
  // Check channel commissions configured
  const channelCommissions = costSettings?.channel_commissions;
  if (channelCommissions && Object.keys(channelCommissions.byChannel || {}).length > 0) {
    score++;
  } else {
    issues.push('Comisiones de canales usando valores por defecto');
  }
  
  // Check starting balance
  if (costSettings?.starting_cash_balance > 0) {
    score++;
  } else {
    issues.push('Saldo de caja inicial no configurado');
  }
  
  return {
    isComplete: score >= 2, // At least variable + fixed configured
    issues,
    completionPercent: Math.round((score / maxScore) * 100),
  };
}

export default {
  calculateReservationEconomicsSummary,
  getReservationEconomicsList,
  getReservationEconomicsDetail,
  getChannelLossPatterns,
  checkCostsConfigured,
};

