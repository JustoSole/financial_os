import database from '../db';
import cacheService from './cache-service';
import { calculateProfitabilityMetrics } from './calculators/profit-engine';
import { calculateMinimumPrice } from './calculators/pricing-engine';
import { 
  HomeMetrics, 
  CashMetrics, 
  ChannelMetrics, 
  CollectionsData,
  TrustLevel,
  StructureMetrics,
  ReconciliationMetrics,
  ARAging,
  DEFAULT_CHANNEL_COMMISSIONS,
  RevenueProjection,
  PeriodComparison,
  DOWPerformance,
  YoYComparison,
  calculateTotalFixedCosts,
} from '../types';
import { getVariableCostPerNight } from './costs-utils';

// =====================================================
// Metrics Service - Home Dashboard (Section 7.1)
// 4 metrics: Cobrado, Cargado, Pendiente, Ahorro potencial
// =====================================================

export function calculateHomeMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): HomeMetrics {
  const cacheKey = `home-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<HomeMetrics>(cacheKey);
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

  const startDate = new Date(startStr);
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - days * 24 * 60 * 60 * 1000);

  const prevStartStr = prevStartDate.toISOString().substring(0, 10);
  const prevEndStr = prevEndDate.toISOString().substring(0, 10);

  // Get data health for trust levels
  const dataHealth = database.getDataHealth(propertyId);
  const hasTxnData = dataHealth.hasExpandedTransactions;
  
  // 1. Cobrado (Real) - SUM(Credits) excluding void
  const cobrado = database.sumCredits(propertyId, startStr, endStr);
  const prevCobrado = database.sumCredits(propertyId, prevStartStr, prevEndStr);
  
  // 2. Cargado (Real) - SUM(Debits)
  const cargado = database.sumDebits(propertyId, startStr, endStr);
  const prevCargado = database.sumDebits(propertyId, prevStartStr, prevEndStr);
  
  // 3. Pendiente (Real) - SUM(balance_due) from Reservations with Financials
  // The spec says Pendiente is SUM(balance_due), not Cargado - Cobrado
  const pendiente = database.getTotalBalanceDue(propertyId);
  // Note: For delta we would need a snapshot of balance_due in the past, 
  // but since we only have the current state in Reservations Report, we'll keep delta as null or 0
  const prevPendiente = 0; 
  
  // 4. Ahorro potencial por mix (Estimado)
  const ahorro = calculateSavingsPotential(propertyId);
  
  // Trust levels
  const txnTrust: TrustLevel = hasTxnData ? 'real' : 'incompleto';
  const resTrust: TrustLevel = dataHealth.hasReservationsFinancials ? 'real' : 'incompleto';

  const result: HomeMetrics = {
    period: {
      start: startStr,
      end: endStr,
      days,
    },
    cobrado: {
      value: cobrado,
      previousValue: prevCobrado > 0 ? prevCobrado : null,
      delta: prevCobrado > 0 ? ((cobrado - prevCobrado) / prevCobrado) * 100 : null,
      trust: txnTrust,
      source: 'Expanded Transaction Report',
      explainFormula: 'SUM(Credits) de todas las transacciones (excluyendo anuladas)',
    },
    cargado: {
      value: cargado,
      previousValue: prevCargado > 0 ? prevCargado : null,
      delta: prevCargado > 0 ? ((cargado - prevCargado) / prevCargado) * 100 : null,
      trust: txnTrust,
      source: 'Expanded Transaction Report',
      explainFormula: 'SUM(Debits) de todas las transacciones',
    },
    pendiente: {
      value: pendiente,
      previousValue: null,
      delta: null,
      trust: resTrust,
      source: 'Reservations with Financials',
      explainFormula: 'SUM(balance_due) de todas las reservas activas.',
    },
    ahorroPotencial: {
      value: ahorro.value,
      previousValue: null,
      delta: null,
      trust: 'estimado',
      source: 'Channel Performance Summary + tasas estimadas',
      explainFormula: ahorro.formula,
      topChannel: ahorro.topChannel,
      suggestion: ahorro.suggestion,
    },
    dataHealth,
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Savings Potential Calculation (Section 7.1 - Metric 4)
// "Si movés 10% del canal más caro a Direct: ~$X/mes"
// =====================================================

function calculateSavingsPotential(propertyId: string): {
  value: number;
  topChannel: string;
  suggestion: string;
  formula: string;
} {
  const costSettings = database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0.15;
  const overrides = costSettings?.channel_commission_overrides || {};
  
  const channels = database.getChannelSummary(propertyId);
  
  if (channels.length === 0) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Importá el Channel Performance Summary para ver tu ahorro potencial',
      formula: 'Sin datos de canales',
    };
  }
  
  // Find most expensive channel (highest commission rate)
  let mostExpensive: any = null;
  let highestRate = 0;
  
  for (const ch of channels) {
    // Get commission rate for this channel
    const channelLower = ch.source.toLowerCase();
    let rate = overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate;
    
    // If channel has actual commission data, use it
    if (ch.estimated_commission > 0 && ch.room_revenue_total > 0) {
      rate = ch.estimated_commission / ch.room_revenue_total;
    }
    
    if (rate > highestRate && ch.room_revenue_total > 0) {
      highestRate = rate;
      mostExpensive = { ...ch, effectiveRate: rate };
    }
  }
  
  if (!mostExpensive) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Todos tus canales tienen comisión 0%',
      formula: 'Sin comisiones detectadas',
    };
  }
  
  // Calculate potential savings: if 10% of this channel moves to Direct (0% commission)
  const revenueToMove = mostExpensive.room_revenue_total * 0.1;
  const currentCommission = revenueToMove * highestRate;
  const potentialSavings = currentCommission; // Moving to Direct = 0% commission
  
  return {
    value: Math.round(potentialSavings),
    topChannel: mostExpensive.source,
    suggestion: `Si movés 10% de ${mostExpensive.source} a reserva directa: ~$${Math.round(potentialSavings).toLocaleString()}/mes`,
    formula: `10% de revenue de ${mostExpensive.source} ($${Math.round(revenueToMove).toLocaleString()}) × ${(highestRate * 100).toFixed(0)}% comisión`,
  };
}

// =====================================================
// Cash Metrics (Section 7.2)
// Runway, daily flow, alerts
// =====================================================

export function calculateCashMetrics(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): CashMetrics {
  const cacheKey = `cash-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<CashMetrics>(cacheKey);
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
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 90;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }
  
  // Get cost settings for starting balance
  const costSettings = database.getCostSettings(propertyId);
  const startingBalance = costSettings?.starting_cash_balance || 0;
  
  // Get daily flow
  const dailyFlow = database.getDailyFlow(propertyId, startStr, endStr);
  
  // Calculate average net daily
  let avgNetDaily = 0;
  if (dailyFlow.length > 0) {
    const totalNet = dailyFlow.reduce((sum, d) => sum + d.netFlow, 0);
    avgNetDaily = totalNet / dailyFlow.length;
  }
  
  // Calculate runway
  let runwayDays: number;
  let trust: TrustLevel = 'estimado';
  
  if (startingBalance === 0) {
    runwayDays = 0;
    trust = 'incompleto';
  } else if (avgNetDaily >= 0) {
    runwayDays = 999; // Infinite (positive cash flow)
  } else {
    runwayDays = Math.floor(startingBalance / Math.abs(avgNetDaily));
  }
  
  // Get alerts
  const alerts = database.getAlerts(propertyId, startStr, endStr);
  
  const result: CashMetrics = {
    period: {
      start: startStr,
      end: endStr,
      days,
    },
    runway: {
      days: runwayDays,
      trust,
      startingBalance,
      avgNetDaily,
    },
    dailyFlow,
    alerts,
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Channel Metrics (Section 7.3) - IMPROVED with ADR analysis
// Now uses reservation data filtered by period for accurate date filtering
// =====================================================

export function calculateChannelMetrics(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): ChannelMetrics {
  const cacheKey = `channels-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<ChannelMetrics>(cacheKey);
  if (cached) return cached;

  const costSettings = database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0.15;
  const overrides = costSettings?.channel_commission_overrides || {};
  
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
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 90;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }
  
  // Get channel data from reservations (filtered by period) - PRIMARY SOURCE for date filtering
  const channelDataFromReservations = database.getChannelSummaryFromReservations(propertyId, startStr, endStr);
  
  // Fallback to static Channel Summary if no reservation data
  const staticChannelData = database.getChannelSummary(propertyId);
  
  // Use reservation data if available, otherwise fall back to static (with warning)
  const hasReservationData = channelDataFromReservations.length > 0;
  const channelData = hasReservationData ? channelDataFromReservations : staticChannelData;
  
  // Calculate total revenue and nights
  const totalRevenue = channelData.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const totalNights = channelData.reduce((sum, c) => sum + c.room_nights, 0);
  
  // Find Direct channel ADR as baseline
  const directChannels = channelData.filter(c => 
    ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono'].includes(c.source.toLowerCase()) ||
    c.source_category?.toLowerCase() === 'direct'
  );
  const directRevenue = directChannels.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const directNights = directChannels.reduce((sum, c) => sum + c.room_nights, 0);
  const directAdr = directNights > 0 ? directRevenue / directNights : 0;
  
  // Build channel list with ADR analysis
  const channels = channelData.map(ch => {
    const channelLower = ch.source.toLowerCase();
    
    // Determine commission rate from settings or defaults
    let effectiveRate = overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate;
    let isEstimated = true;
    
    // If static channel data has actual commission data, use it to get rate
    const staticChannel = staticChannelData.find(s => s.source.toLowerCase() === channelLower);
    if (staticChannel && staticChannel.estimated_commission > 0 && staticChannel.room_revenue_total > 0) {
      effectiveRate = staticChannel.estimated_commission / staticChannel.room_revenue_total;
      isEstimated = false;
    }
    
    // Skip commission for Direct channels
    const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono'].includes(channelLower) ||
      ch.source_category?.toLowerCase() === 'direct';
    if (isDirect) {
      effectiveRate = 0;
      isEstimated = false;
    }
    
    const commission = ch.room_revenue_total * effectiveRate;
    
    // Calculate ADR metrics
    const adr = ch.room_nights > 0 ? ch.room_revenue_total / ch.room_nights : 0;
    const adrNet = adr * (1 - effectiveRate); // ADR after commission
    
    // Calculate real cost vs Direct (ADR difference + commission)
    // UNBIASED: A higher ADR can offset a higher commission
    let realCostPercent = effectiveRate * 100; // Start with commission
    if (directAdr > 0 && adr > 0 && !isDirect) {
      // If ADR is LOWER than direct, it adds to cost. If HIGHER, it subtracts from cost.
      const adrGapPercent = ((directAdr - adr) / directAdr) * 100;
      realCostPercent += adrGapPercent;
    }
    
    return {
      source: ch.source,
      sourceCategory: ch.source_category || 'Otro',
      revenue: ch.room_revenue_total,
      revenueShare: totalRevenue > 0 ? ch.room_revenue_total / totalRevenue : 0,
      roomNights: ch.room_nights,
      estimatedCommission: Math.round(commission),
      effectiveCommissionRate: effectiveRate,
      isCommissionEstimated: isEstimated,
      // ADR metrics
      adr: Math.round(adr),
      adrNet: Math.round(adrNet),
      realCostPercent: Math.round(realCostPercent * 10) / 10,
    };
  });
  
  // Sort by ADR Net (best performing channels first)
  const sortedByAdrNet = [...channels].filter(c => c.roomNights > 0).sort((a, b) => b.adrNet - a.adrNet);
  
  // Find best and worst channels (excluding low volume)
  const significantChannels = sortedByAdrNet.filter(c => c.revenueShare > 0.05);
  const bestChannel = significantChannels[0] || null;
  const worstChannel = significantChannels[significantChannels.length - 1] || null;
  
  // Calculate OTA dependency
  const otaRevenue = channels
    .filter(c => c.sourceCategory.toLowerCase() === 'ota')
    .reduce((sum, c) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? otaRevenue / totalRevenue : 0;
  
  // Find top channel category
  const categoryRevenue: Record<string, number> = {};
  for (const ch of channels) {
    const cat = ch.sourceCategory;
    categoryRevenue[cat] = (categoryRevenue[cat] || 0) + ch.revenue;
  }
  const topCategory = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])[0];
  
  // Savings potential (using period data)
  const savings = calculateSavingsPotentialForPeriod(propertyId, channelData, defaultRate, overrides);
  
  const result: ChannelMetrics = {
    period: {
      start: startStr,
      end: endStr,
      days,
    },
    channels,
    dependency: {
      topChannelCategory: topCategory ? topCategory[0] : '-',
      sharePercent: topCategory ? (topCategory[1] / totalRevenue) * 100 : 0,
      isHighDependency: otaShare > 0.7,
    },
    savingsPotential: {
      value: savings.value,
      description: savings.suggestion,
      trust: 'estimado',
    },
    // Insights
    insights: {
      bestChannel: bestChannel ? {
        name: bestChannel.source,
        adrNet: bestChannel.adrNet,
        reason: `Mejor ADR neto: $${bestChannel.adrNet.toLocaleString()}/noche`
      } : null,
      worstChannel: worstChannel && worstChannel.realCostPercent > 15 ? {
        name: worstChannel.source,
        adrNet: worstChannel.adrNet,
        realCost: `Costo real: ${worstChannel.realCostPercent.toFixed(0)}% (comisión ${(worstChannel.effectiveCommissionRate * 100).toFixed(0)}% + ADR ${directAdr > worstChannel.adr ? Math.round((directAdr - worstChannel.adr) / directAdr * 100) : 0}% más bajo)`
      } : null,
      directAdr: Math.round(directAdr),
    },
    // Metadata about data source
    dataSource: hasReservationData ? 'reservations' : 'channel_summary',
  };

  cacheService.set(cacheKey, result);
  return result;
}

// Helper function to calculate savings for a specific period's channel data
function calculateSavingsPotentialForPeriod(
  propertyId: string, 
  channels: any[], 
  defaultRate: number, 
  overrides: Record<string, number>
): { value: number; topChannel: string; suggestion: string; formula: string } {
  if (channels.length === 0) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Importá el Reservations with Financials para ver tu ahorro potencial',
      formula: 'Sin datos de canales',
    };
  }
  
  // Find most expensive channel (highest commission rate)
  let mostExpensive: any = null;
  let highestRate = 0;
  
  for (const ch of channels) {
    const channelLower = ch.source.toLowerCase();
    
    // Skip direct channels
    const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono'].includes(channelLower) ||
      ch.source_category?.toLowerCase() === 'direct';
    if (isDirect) continue;
    
    const rate = overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate;
    
    if (rate > highestRate && ch.room_revenue_total > 0) {
      highestRate = rate;
      mostExpensive = { ...ch, effectiveRate: rate };
    }
  }
  
  if (!mostExpensive) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Todos tus canales tienen comisión 0%',
      formula: 'Sin comisiones detectadas',
    };
  }
  
  // Calculate potential savings: if 10% of this channel moves to Direct (0% commission)
  const revenueToMove = mostExpensive.room_revenue_total * 0.1;
  const potentialSavings = revenueToMove * highestRate;
  
  return {
    value: Math.round(potentialSavings),
    topChannel: mostExpensive.source,
    suggestion: `Si movés 10% de ${mostExpensive.source} a reserva directa: ~$${Math.round(potentialSavings).toLocaleString()}/mes`,
    formula: `10% de revenue de ${mostExpensive.source} ($${Math.round(revenueToMove).toLocaleString()}) × ${(highestRate * 100).toFixed(0)}% comisión`,
  };
}

// =====================================================
// NEW: Revenue Projection (Future bookings analysis)
// =====================================================

export function calculateRevenueProjection(propertyId: string, weeksAhead: number = 4): RevenueProjection {
  const cacheKey = `projection-${propertyId}-${weeksAhead}`;
  const cached = cacheService.get<RevenueProjection>(cacheKey);
  if (cached) return cached;

  const reservations = database.getReservationsByProperty(propertyId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
  
  // Filter future reservations (not cancelled)
  const futureReservations = reservations.filter(r => {
    if (r.status === 'Cancelled') return false;
    const checkIn = new Date(r.check_in);
    return checkIn >= today && checkIn <= endDate;
  });
  
  // Group by week
  const weeks: RevenueProjection['weeks'] = [];
  const alerts: RevenueProjection['alerts'] = [];
  
  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    const weekReservations = futureReservations.filter(r => {
      const checkIn = new Date(r.check_in);
      return checkIn >= weekStart && checkIn <= weekEnd;
    });
    
    const confirmedNights = weekReservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const expectedRevenue = weekReservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    const alreadyPaid = weekReservations.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const pendingPayment = expectedRevenue - alreadyPaid;
    const paidPercent = expectedRevenue > 0 ? (alreadyPaid / expectedRevenue) * 100 : 100;
    
    // Generate alert if low payment percentage
    if (pendingPayment > 100000 && paidPercent < 50) {
      alerts.push({
        weekStart: weekStart.toISOString().substring(0, 10),
        message: `Semana ${weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}: Solo ${paidPercent.toFixed(0)}% pagado ($${Math.round(pendingPayment).toLocaleString()} pendiente)`,
        severity: paidPercent < 30 ? 'danger' : 'warning',
        amount: pendingPayment,
      });
    }
    
    weeks.push({
      weekStart: weekStart.toISOString().substring(0, 10),
      weekEnd: weekEnd.toISOString().substring(0, 10),
      confirmedNights,
      expectedRevenue,
      alreadyPaid,
      pendingPayment,
      paidPercent,
      reservations: weekReservations.slice(0, 10).map(r => ({
        reservationNumber: r.reservation_number,
        guestName: r.guest_name || 'Sin nombre',
        checkIn: r.check_in,
        source: r.source || 'Desconocido',
        revenue: r.room_revenue_total || 0,
        paid: r.paid_amount || 0,
        balance: r.balance_due || 0,
      })),
    });
  }
  
  // Calculate totals
  const totals = {
    confirmedNights: weeks.reduce((sum, w) => sum + w.confirmedNights, 0),
    expectedRevenue: weeks.reduce((sum, w) => sum + w.expectedRevenue, 0),
    alreadyPaid: weeks.reduce((sum, w) => sum + w.alreadyPaid, 0),
    pendingPayment: weeks.reduce((sum, w) => sum + w.pendingPayment, 0),
    paidPercent: 0,
  };
  totals.paidPercent = totals.expectedRevenue > 0 
    ? (totals.alreadyPaid / totals.expectedRevenue) * 100 
    : 100;
  
  const result: RevenueProjection = {
    period: {
      start: today.toISOString().substring(0, 10),
      end: endDate.toISOString().substring(0, 10),
    },
    weeks,
    totals,
    alerts,
  };

  cacheService.set(cacheKey, result);
  return result;
}

export function calculateMoMComparison(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): PeriodComparison | null {
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

  const currentStart = new Date(startStr);
  
  // Previous Period: Same number of days before current start
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const prevStartStr = prevStart.toISOString().substring(0, 10);
  const prevEndStr = prevEnd.toISOString().substring(0, 10);

  const getMetricsForPeriod = (startStr: string, endStr: string) => {
    const reservations = database.getReservationsByProperty(propertyId).filter(r => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      return checkIn >= startStr && checkIn <= endStr;
    });

    if (reservations.length === 0) return null;

    const revenue = reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    const nights = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const adr = nights > 0 ? revenue / nights : 0;
    
    // Calculate shares
    const directRevenue = reservations
      .filter(r => {
        const source = r.source?.toLowerCase() || '';
        return ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'].includes(source);
      })
      .reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    
    const directShare = revenue > 0 ? (directRevenue / revenue) * 100 : 0;
    const otaShare = 100 - directShare;

    // Calculate commissions (approximate using rates)
    const costSettings = database.getCostSettings(propertyId);
    const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;
    const overrides = costSettings?.channel_commissions?.byChannel || {};
    
    const totalCommissions = reservations.reduce((sum, r) => {
      const source = r.source?.toLowerCase() || '';
      const isDirect = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'].includes(source);
      if (isDirect) return sum;
      const rate = overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate;
      return sum + (r.room_revenue_total * rate);
    }, 0);

    const roomCount = costSettings?.room_count || 1;
    const occupancy = (nights / (roomCount * days)) * 100;

    return { revenue, adr, occupancy, nights, directShare, otaShare, commissions: totalCommissions };
  };

  const current = getMetricsForPeriod(startStr, endStr);
  const previous = getMetricsForPeriod(prevStartStr, prevEndStr);

  if (!current || !previous) return null;

  return {
    current: {
      start: startStr,
      end: endStr,
      label: 'Período actual',
    },
    previous: {
      start: prevStartStr,
      end: prevEndStr,
      label: 'Período anterior',
    },
    metrics: {
      revenue: {
        current: current.revenue,
        previous: previous.revenue,
        change: current.revenue - previous.revenue,
        changePercent: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0,
      },
      adr: {
        current: current.adr,
        previous: previous.adr,
        change: current.adr - previous.adr,
        changePercent: previous.adr > 0 ? ((current.adr - previous.adr) / previous.adr) * 100 : 0,
      },
      nights: {
        current: current.nights,
        previous: previous.nights,
        change: current.nights - previous.nights,
        changePercent: previous.nights > 0 ? ((current.nights - previous.nights) / previous.nights) * 100 : 0,
      },
      occupancy: {
        current: current.occupancy,
        previous: previous.occupancy,
        change: current.occupancy - previous.occupancy,
        changePercent: previous.occupancy > 0 ? ((current.occupancy - previous.occupancy) / previous.occupancy) * 100 : 0,
      },
      directShare: {
        current: current.directShare,
        previous: previous.directShare,
        change: current.directShare - previous.directShare,
        changePercent: previous.directShare > 0 ? ((current.directShare - previous.directShare) / previous.directShare) * 100 : 0,
      },
      otaShare: {
        current: current.otaShare,
        previous: previous.otaShare,
        change: current.otaShare - previous.otaShare,
        changePercent: previous.otaShare > 0 ? ((current.otaShare - previous.otaShare) / previous.otaShare) * 100 : 0,
      },
      commissions: {
        current: current.commissions,
        previous: previous.commissions,
        change: current.commissions - previous.commissions,
        changePercent: previous.commissions > 0 ? ((current.commissions - previous.commissions) / previous.commissions) * 100 : 0,
      },
    },
    insights: [],
  };
}

// =====================================================
// NEW: Structure Metrics (Occupancy, ADR, RevPAR, GOPPAR)
// =====================================================

export function calculateStructureMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): StructureMetrics {
  const cacheKey = `structure-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<StructureMetrics>(cacheKey);
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

  const costSettings = database.getCostSettings(propertyId);
  const roomCount = costSettings?.room_count || 0;
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  
  // Get data health
  const health = database.getDataHealth(propertyId);

  // Sum room nights and revenue from reservations in period
  const reservations = database.getReservationsByProperty(propertyId).filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const totalRoomNights = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const totalRoomRevenue = reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
  
  // Calculate Net Room Revenue (Revenue - Commissions)
  const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;
  const overrides = costSettings?.channel_commissions?.byChannel || {};
  
  const totalNetRoomRevenue = reservations.reduce((sum, r) => {
    const source = r.source?.toLowerCase() || 'directo';
    const rate = overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate;
    return sum + (r.room_revenue_total * (1 - rate));
  }, 0);

  // Available room nights
  const availableRoomNights = roomCount * days;
  
  // Calculate KPIs
  const occupancyRate = availableRoomNights > 0 ? (totalRoomNights / availableRoomNights) * 100 : 0;
  const ADR = totalRoomNights > 0 ? totalRoomRevenue / totalRoomNights : 0;
  const RevPAR = availableRoomNights > 0 ? totalRoomRevenue / availableRoomNights : 0;
  const NRevPAR = availableRoomNights > 0 ? totalNetRoomRevenue / availableRoomNights : 0;
  
  // GOPPAR calculation
  // Total Operating Profit = Revenue - (Fixed Costs + Variable Costs)
  const daysInMonth = 30.44;
  const periodFixedCosts = (fixedMonthly / daysInMonth) * days;
  
  // Variable costs
  const { perNightBase, cleaningTotal } = getVariableCostPerNight(
    costSettings,
    totalRoomNights,
    reservations.length
  );
  const periodVariableCosts = (totalRoomNights * perNightBase) + cleaningTotal;
  
  const totalOperatingProfit = totalRoomRevenue - (periodFixedCosts + periodVariableCosts);
  const GOPPAR = availableRoomNights > 0 ? totalOperatingProfit / availableRoomNights : 0;

  // Confidence level
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (totalRoomNights < 5 || roomCount === 0 || !health.hasReservationsFinancials) {
    confidence = 'low';
  } else if (totalRoomNights < 20 || !health.hasExpandedTransactions) {
    confidence = 'medium';
  }

  const result: StructureMetrics = {
    period: { start: startStr, end: endStr, days },
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    ADR: Math.round(ADR),
    RevPAR: Math.round(RevPAR),
    NRevPAR: Math.round(NRevPAR),
    GOPPAR: Math.round(GOPPAR),
    roomCount,
    confidence
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// NEW: Reconciliation Metrics (Charged vs Collected)
// =====================================================

export function calculateReconciliation(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): ReconciliationMetrics {
  const cacheKey = `reconcile-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<ReconciliationMetrics>(cacheKey);
  if (cached) return cached;

  let startStr: string;
  let endStr: string;

  if (typeof startDateOrDays === 'string' && endDate) {
    startStr = startDateOrDays;
    endStr = endDate;
  } else {
    const days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }

  const totalDebits = database.sumDebits(propertyId, startStr, endStr);
  const totalCredits = database.sumCredits(propertyId, startStr, endStr);
  const gap = totalDebits - totalCredits;
  
  let explanation = "Balanced";
  let status: 'balanced' | 'surplus' | 'deficit' = 'balanced';
  
  if (gap > 50) {
    explanation = "Revenue reconocido pero no cobrado aún (Cuentas por cobrar)";
    status = 'deficit';
  } else if (gap < -50) {
    explanation = "Pagos recibidos antes del reconocimiento del ingreso (Pagos anticipados)";
    status = 'surplus';
  }

  const result: ReconciliationMetrics = {
    period: { start: startStr, end: endStr },
    totalDebits,
    totalCredits,
    gap,
    explanation,
    status
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// NEW: A/R Aging (Bucketed Collections)
// =====================================================

export function getARAging(propertyId: string): ARAging {
  const cacheKey = `ar-aging-${propertyId}`;
  const cached = cacheService.get<ARAging>(cacheKey);
  if (cached) return cached;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().substring(0, 10);
  
  const reservations = database.getReservationsWithBalance(propertyId);
  
  const buckets = {
    overdue: 0,
    next7: 0,
    next30: 0,
    future: 0
  };

  for (const r of reservations) {
    const checkInDate = new Date(r.check_in);
    checkInDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      buckets.overdue += r.balance_due;
    } else if (diffDays <= 7) {
      buckets.next7 += r.balance_due;
    } else if (diffDays <= 30) {
      buckets.next30 += r.balance_due;
    } else {
      buckets.future += r.balance_due;
    }
  }

  const result: ARAging = {
    buckets,
    total: Object.values(buckets).reduce((sum, v) => sum + v, 0),
    lastUpdate: new Date().toISOString()
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// NEW: Break-even Metrics
// =====================================================

export function calculateBreakEven(propertyId: string) {
  const cacheKey = `breakeven-${propertyId}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return cached;

  const costSettings = database.getCostSettings(propertyId);
  const roomCount = costSettings?.room_count || 0;
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  
  // Get aggregate metrics for baseline ADR and commissions
  const structure = calculateStructureMetrics(propertyId, 90); // Use 90 days for stable ADR
  const channels = calculateChannelMetrics(propertyId, 90);
  
  const ADR = structure.ADR;
  const totalRevenue = channels.channels.reduce((sum, c) => sum + c.revenue, 0);
  const totalCommission = channels.channels.reduce((sum, c) => sum + c.estimatedCommission, 0);
  const avgComm = totalRevenue > 0 ? totalCommission / totalRevenue : 0;
  
  const estimatedOccupiedNights = (structure.occupancyRate / 100) * roomCount * structure.period.days;
  const { perNightTotal: totalVarPerNight } = getVariableCostPerNight(
    costSettings,
    estimatedOccupiedNights,
    0
  );
  
  // Contribution per night = ADR * (1 - comm) - Variable
  const contribPerNight = ADR * (1 - avgComm) - totalVarPerNight;
  
  let breakEvenOccupancy = 0;
  let isImpossible = false;
  
  if (contribPerNight <= 0) {
    breakEvenOccupancy = 100;
    isImpossible = true;
  } else {
    // Break-even occupancy = (Monthly Fixed Costs / 30.44 / Contrib per Night) / Room Count
    breakEvenOccupancy = ((fixedMonthly / 30.44) / contribPerNight) / roomCount;
  }

  const result = {
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 100 * 10) / 10,
    currentOccupancy: structure.occupancyRate,
    isImpossible,
    contribPerNight,
    fixedPerDay: fixedMonthly / 30.44
  };

  cacheService.set(cacheKey, result);
  return result;
}

export function getCollectionsData(propertyId: string): CollectionsData {
  const totalBalanceDue = database.getTotalBalanceDue(propertyId);
  const reservations = database.getReservationsWithBalance(propertyId);
  
  // Calculate total paid from all reservations
  const allReservations = database.getReservationsByProperty(propertyId);
  const totalPaid = allReservations.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
  
  return {
    totalBalanceDue,
    totalPaid,
    reservationsWithBalance: reservations.map(r => ({
      reservationNumber: r.reservation_number,
      guestName: r.guest_name || null,
      status: r.status,
      source: r.source || 'Desconocido',
      checkIn: r.check_in,
      checkOut: r.check_out,
      totalAmount: r.room_revenue_total || 0,
      paidAmount: r.paid_amount,
      balanceDue: r.balance_due,
      suggestedDeposit: r.suggested_deposit,
      depositGap: Math.max(0, r.suggested_deposit - r.paid_amount),
    })),
  };
}

// =====================================================
// Deposit Gaps (for actions)
// =====================================================

export function getDepositGaps(propertyId: string) {
  return database.getDepositGaps(propertyId);
}

// =====================================================
// Channel Breakdown (for API)
// =====================================================

export function getChannelBreakdown(propertyId: string, days: number = 90) {
  return database.getChannelSummary(propertyId);
}

// =====================================================
// NEW: Confidence Score (Section 6.1)
// =====================================================

export function calculateConfidenceScore(propertyId: string) {
  const costSettings = database.getCostSettings(propertyId);
  const dataHealth = database.getDataHealth(propertyId);
  
  const hasRoomCount = (costSettings?.room_count || 0) > 0;
  const hasReservations = dataHealth.hasReservationsFinancials;
  const hasCommissions = costSettings?.channel_commissions && Object.keys(costSettings.channel_commissions.byChannel).length > 0;
  const hasCosts = costSettings?.fixed_costs && calculateTotalFixedCosts(costSettings.fixed_costs) > 0;

  if (!hasRoomCount || !hasReservations) return 'LOW';
  if (!hasCommissions || !hasCosts) return 'MEDIUM';
  return 'HIGH';
}

// =====================================================
// NEW: Strategic Metrics Wrappers
// =====================================================

export function getProfitabilityMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string) {
  return calculateProfitabilityMetrics(propertyId, startDateOrDays, endDate);
}

export function getMinimumPriceSimulation(propertyId: string, marginPct: number) {
  return calculateMinimumPrice(propertyId, marginPct);
}

export function getDailyFlow(propertyId: string, days: number = 30) {
  const endDate = new Date().toISOString().substring(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  return database.getDailyFlow(propertyId, startDate, endDate);
}

// =====================================================
// NEW: DOW Performance (Section 3.23)
// =====================================================

export function calculateDOWPerformance(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): DOWPerformance[] {
  const cacheKey = `dow-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<DOWPerformance[]>(cacheKey);
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
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 90;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }

  const startDate = new Date(startStr);
  const endDateObj = new Date(endStr);

  const reservations = database.getReservationsByProperty(propertyId).filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const costSettings = database.getCostSettings(propertyId);
  const roomCount = costSettings?.room_count || 1;
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const fixedPerDay = fixedMonthly / 30.44;

  const dowData: Record<number, { nights: number; revenue: number; resCount: number }> = {};
  for (let i = 0; i < 7; i++) {
    dowData[i] = { nights: 0, revenue: 0, resCount: 0 };
  }

  reservations.forEach(r => {
    const date = new Date(r.check_in);
    const dow = date.getDay();
    dowData[dow].nights += (r.room_nights || 0);
    dowData[dow].revenue += (r.room_revenue_total || 0);
    dowData[dow].resCount += 1;
  });

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // Estimate number of each day of week in the period
  const dayOccurrences: Record<number, number> = {};
  for (let i = 0; i < 7; i++) dayOccurrences[i] = 0;
  
  let current = new Date(startDate);
  while (current <= endDateObj) {
    dayOccurrences[current.getDay()] += 1;
    current.setDate(current.getDate() + 1);
  }

  const result: DOWPerformance[] = Object.entries(dowData).map(([dowStr, data]) => {
    const dow = parseInt(dowStr);
    const occurrences = dayOccurrences[dow] || (days / 7);
    const availableNights = occurrences * roomCount;
    const occupancyRate = availableNights > 0 ? (data.nights / availableNights) * 100 : 0;
    
    // Simple profit estimation per DOW
    const { perNightBase, cleaningTotal } = getVariableCostPerNight(
      costSettings,
      data.nights,
      data.resCount
    );
    const totalVarCosts = (data.nights * perNightBase) + cleaningTotal;
    
    const netProfit = data.revenue - (occurrences * fixedPerDay) - totalVarCosts;
    
    return {
      dayOfWeek: dow,
      dayLabel: dayLabels[dow],
      roomNights: data.nights,
      revenue: data.revenue,
      netProfit: Math.round(netProfit),
      profitPerNight: data.nights > 0 ? Math.round(netProfit / data.nights) : 0,
      occupancyRate: Math.round(occupancyRate * 10) / 10
    };
  });

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// NEW: YoY Comparison (Section 3.17)
// =====================================================

export function calculateYoYComparison(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): YoYComparison | null {
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

  const currentStart = new Date(startStr);
  const currentEnd = new Date(endStr);
  
  // Previous Year Period: Same dates, 1 year ago
  const prevEnd = new Date(currentEnd);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  const prevStart = new Date(currentStart);
  prevStart.setFullYear(prevStart.getFullYear() - 1);

  const prevStartStr = prevStart.toISOString().substring(0, 10);
  const prevEndStr = prevEnd.toISOString().substring(0, 10);

  const getMetricsForPeriod = (startStr: string, endStr: string) => {
    const reservations = database.getReservationsByProperty(propertyId).filter(r => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      return checkIn >= startStr && checkIn <= endStr;
    });

    if (reservations.length === 0) return null;

    const revenue = reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    const nights = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const adr = nights > 0 ? revenue / nights : 0;
    
    const costSettings = database.getCostSettings(propertyId);
    const roomCount = costSettings?.room_count || 1;
    const occupancy = (nights / (roomCount * days)) * 100;

    return { revenue, adr, occupancy, nights };
  };

  const current = getMetricsForPeriod(startStr, endStr);
  const previousYear = getMetricsForPeriod(prevStartStr, prevEndStr);

  if (!current || !previousYear) return null;

  return {
    current: {
      label: 'Período actual',
      ...current
    },
    previousYear: {
      label: 'Mismo período año anterior',
      ...previousYear
    },
    deltas: {
      revenuePercent: previousYear.revenue > 0 ? ((current.revenue - previousYear.revenue) / previousYear.revenue) * 100 : 0,
      adrPercent: previousYear.adr > 0 ? ((current.adr - previousYear.adr) / previousYear.adr) * 100 : 0,
      occupancyPercent: previousYear.occupancy > 0 ? ((current.occupancy - previousYear.occupancy) / previousYear.occupancy) * 100 : 0
    }
  };
}
