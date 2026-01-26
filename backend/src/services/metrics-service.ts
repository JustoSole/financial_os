import database from '../db';
import cacheService from './cache-service';
import { CalculationEngine } from './calculation-engine';
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

export async function calculateHomeMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  const dataHealth = await database.getDataHealth(propertyId);
  const hasTxnData = dataHealth.hasExpandedTransactions;
  
  // 1. Cobrado (Real) - SUM(Credits) excluding void
  const cobrado = await database.sumCredits(propertyId, startStr, endStr);
  const prevCobrado = await database.sumCredits(propertyId, prevStartStr, prevEndStr);
  
  // 2. Cargado (Real) - SUM(Debits)
  const cargado = await database.sumDebits(propertyId, startStr, endStr);
  const prevCargado = await database.sumDebits(propertyId, prevStartStr, prevEndStr);
  
  // 3. Pendiente (Real) - SUM(balance_due) from Reservations with Financials
  const pendiente = await database.getTotalBalanceDue(propertyId);
  const prevPendiente = 0; 
  
  // 4. Ahorro potencial por mix (Estimado)
  const ahorro = await calculateSavingsPotential(propertyId);
  
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

async function calculateSavingsPotential(propertyId: string): Promise<any> {
  const costSettings = await database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0;
  const overrides = costSettings?.channel_commission_overrides || {};
  
  const channels = await database.getChannelSummary(propertyId);
  
  if (channels.length === 0) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Importá el Channel Performance Summary para ver tu ahorro potencial',
      formula: 'Sin datos de canales',
    };
  }
  
  let mostExpensive: any = null;
  let highestRate = 0;
  
  for (const ch of channels) {
    const channelLower = ch.source.toLowerCase();
    let rate = overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate;
    
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
  
  const revenueToMove = mostExpensive.room_revenue_total * 0.1;
  const currentCommission = revenueToMove * highestRate;
  const potentialSavings = currentCommission; 
  
  return {
    value: Math.round(potentialSavings),
    topChannel: mostExpensive.source,
    suggestion: `Si movés 10% de ${mostExpensive.source} a reserva directa: ~$${Math.round(potentialSavings).toLocaleString()}/mes`,
    formula: `10% de revenue de ${mostExpensive.source} ($${Math.round(revenueToMove).toLocaleString()}) × ${(highestRate * 100).toFixed(0)}% comisión`,
  };
}

export async function calculateCashMetrics(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): Promise<any> {
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
  
  const costSettings = await database.getCostSettings(propertyId);
  const startingBalance = costSettings?.starting_cash_balance || 0;
  
  const dailyFlow = await database.getDailyFlow(propertyId, startStr, endStr);
  
  let avgNetDaily = 0;
  if (dailyFlow.length > 0) {
    const totalNet = dailyFlow.reduce((sum, d) => sum + d.netFlow, 0);
    avgNetDaily = totalNet / dailyFlow.length;
  }
  
  let runwayDays: number;
  let trust: TrustLevel = 'estimado';
  
  if (startingBalance === 0) {
    runwayDays = 0;
    trust = 'incompleto';
  } else if (avgNetDaily >= 0) {
    runwayDays = 0; 
  } else {
    runwayDays = Math.floor(startingBalance / Math.abs(avgNetDaily));
  }
  
  const alerts = await database.getAlerts(propertyId, startStr, endStr);
  
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

export async function calculateChannelMetrics(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): Promise<any> {
  const cacheKey = `channels-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<ChannelMetrics>(cacheKey);
  if (cached) return cached;

  const costSettings = await database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0;
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
  
  const channelDataFromReservations = await database.getChannelSummaryFromReservations(propertyId, startStr, endStr);
  const staticChannelData = await database.getChannelSummary(propertyId);
  
  const hasReservationData = channelDataFromReservations.length > 0;
  const channelData = hasReservationData ? channelDataFromReservations : staticChannelData;
  
  const totalRevenue = channelData.reduce((sum, c) => sum + c.room_revenue_total, 0);
  
  const directChannels = channelData.filter(c => 
    ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono'].includes(c.source.toLowerCase()) ||
    c.source_category?.toLowerCase() === 'direct'
  );
  const directRevenue = directChannels.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const directNights = directChannels.reduce((sum, c) => sum + c.room_nights, 0);
  const directAdr = directNights > 0 ? directRevenue / directNights : 0;
  
  const channels = channelData.map(ch => {
    const channelLower = ch.source.toLowerCase();
    let effectiveRate = overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate;
    let isEstimated = true;
    
    const staticChannel = staticChannelData.find(s => s.source.toLowerCase() === channelLower);
    if (staticChannel && staticChannel.estimated_commission > 0 && staticChannel.room_revenue_total > 0) {
      effectiveRate = staticChannel.estimated_commission / staticChannel.room_revenue_total;
      isEstimated = false;
    }
    
    const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono'].includes(channelLower) ||
      ch.source_category?.toLowerCase() === 'direct';
    if (isDirect) {
      effectiveRate = 0;
      isEstimated = false;
    }
    
    const commission = ch.room_revenue_total * effectiveRate;
    const adr = ch.room_nights > 0 ? ch.room_revenue_total / ch.room_nights : 0;
    const adrNet = adr * (1 - effectiveRate); 
    
    let realCostPercent = effectiveRate * 100; 
    if (directAdr > 0 && adr > 0 && !isDirect) {
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
      adr: Math.round(adr),
      adrNet: Math.round(adrNet),
      realCostPercent: Math.round(realCostPercent * 10) / 10,
    };
  });
  
  const sortedByAdrNet = [...channels].filter(c => c.roomNights > 0).sort((a, b) => b.adrNet - a.adrNet);
  const significantChannels = sortedByAdrNet.filter(c => c.revenueShare > 0.05);
  const bestChannel = significantChannels[0] || null;
  const worstChannel = significantChannels[significantChannels.length - 1] || null;
  
  const otaRevenue = channels
    .filter(c => c.sourceCategory.toLowerCase() === 'ota')
    .reduce((sum, c) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? otaRevenue / totalRevenue : 0;
  
  const categoryRevenue: Record<string, number> = {};
  for (const ch of channels) {
    const cat = ch.sourceCategory;
    categoryRevenue[cat] = (categoryRevenue[cat] || 0) + ch.revenue;
  }
  const topCategory = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])[0];
  
  const savings = await calculateSavingsPotentialForPeriod(propertyId, channelData, defaultRate, overrides);
  
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
    dataSource: hasReservationData ? 'reservations' : 'channel_summary',
  };

  cacheService.set(cacheKey, result);
  return result;
}

async function calculateSavingsPotentialForPeriod(
  propertyId: string, 
  channels: any[], 
  defaultRate: number, 
  overrides: Record<string, number>
): Promise<any> {
  if (channels.length === 0) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Importá el Reservations with Financials para ver tu ahorro potencial',
      formula: 'Sin datos de canales',
    };
  }
  
  let mostExpensive: any = null;
  let highestRate = 0;
  
  for (const ch of channels) {
    const channelLower = ch.source.toLowerCase();
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
  
  const revenueToMove = mostExpensive.room_revenue_total * 0.1;
  const potentialSavings = revenueToMove * highestRate;
  
  return {
    value: Math.round(potentialSavings),
    topChannel: mostExpensive.source,
    suggestion: `Si movés 10% de ${mostExpensive.source} a reserva directa: ~$${Math.round(potentialSavings).toLocaleString()}/mes`,
    formula: `10% de revenue de ${mostExpensive.source} ($${Math.round(revenueToMove).toLocaleString()}) × ${(highestRate * 100).toFixed(0)}% comisión`,
  };
}

export async function calculateRevenueProjection(propertyId: string, weeksAhead: number = 4): Promise<any> {
  const cacheKey = `projection-${propertyId}-${weeksAhead}`;
  const cached = cacheService.get<RevenueProjection>(cacheKey);
  if (cached) return cached;

  const reservations = await database.getReservationsByProperty(propertyId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
  
  const futureReservations = reservations.filter((r: any) => {
    if (r.status === 'Cancelled') return false;
    const checkIn = new Date(r.check_in);
    return checkIn >= today && checkIn <= endDate;
  });
  
  const weeks: RevenueProjection['weeks'] = [];
  const alerts: RevenueProjection['alerts'] = [];
  
  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    const weekReservations = futureReservations.filter((r: any) => {
      const checkIn = new Date(r.check_in);
      return checkIn >= weekStart && checkIn <= weekEnd;
    });
    
    const confirmedNights = weekReservations.reduce((sum: number, r: any) => sum + (r.room_nights || 0), 0);
    const expectedRevenue = weekReservations.reduce((sum: number, r: any) => sum + (r.room_revenue_total || 0), 0);
    const alreadyPaid = weekReservations.reduce((sum: number, r: any) => sum + (r.paid_amount || 0), 0);
    const pendingPayment = expectedRevenue - alreadyPaid;
    const paidPercent = expectedRevenue > 0 ? (alreadyPaid / expectedRevenue) * 100 : 100;
    
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
      reservations: weekReservations.slice(0, 10).map((r: any) => ({
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

export async function calculateMoMComparison(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const prevStartStr = prevStart.toISOString().substring(0, 10);
  const prevEndStr = prevEnd.toISOString().substring(0, 10);

  const getMetricsForPeriod = async (startStr: string, endStr: string) => {
    const reservations = (await database.getReservationsByProperty(propertyId)).filter((r: any) => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      return checkIn >= startStr && checkIn <= endStr;
    });

    if (reservations.length === 0) return null;

    const revenue = reservations.reduce((sum: number, r: any) => sum + (r.room_revenue_total || 0), 0);
    const nights = reservations.reduce((sum: number, r: any) => sum + (r.room_nights || 0), 0);
    const adr = nights > 0 ? revenue / nights : 0;
    
    const directRevenue = reservations
      .filter((r: any) => {
        const source = r.source?.toLowerCase() || '';
        return ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'].includes(source);
      })
      .reduce((sum: number, r: any) => sum + (r.room_revenue_total || 0), 0);
    
    const directShare = revenue > 0 ? (directRevenue / revenue) * 100 : 0;
    const otaShare = 100 - directShare;

    const costSettings = await database.getCostSettings(propertyId);
    const defaultRate = costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = costSettings?.channel_commissions?.byChannel || {};
    
    const totalCommissions = reservations.reduce((sum: number, r: any) => {
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

  const current = await getMetricsForPeriod(startStr, endStr);
  const previous = await getMetricsForPeriod(prevStartStr, prevEndStr);

  // Return empty structure if no data instead of null to avoid frontend crashes
  if (!current) {
    return {
      current: { start: startStr, end: endStr, label: 'Período actual' },
      previous: { start: prevStartStr, end: prevEndStr, label: 'Período anterior' },
      metrics: {
        revenue: { current: 0, previous: 0, change: 0, changePercent: 0 },
        adr: { current: 0, previous: 0, change: 0, changePercent: 0 },
        nights: { current: 0, previous: 0, change: 0, changePercent: 0 },
        occupancy: { current: 0, previous: 0, change: 0, changePercent: 0 },
        directShare: { current: 0, previous: 0, change: 0, changePercent: 0 },
        otaShare: { current: 0, previous: 0, change: 0, changePercent: 0 },
        commissions: { current: 0, previous: 0, change: 0, changePercent: 0 },
        netProfit: { current: 0, previous: 0, change: 0, changePercent: 0 },
      },
      insights: [],
    };
  }

  const prevMetrics = previous || { revenue: 0, adr: 0, occupancy: 0, nights: 0, directShare: 0, otaShare: 0, commissions: 0 };

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
        previous: prevMetrics.revenue,
        change: current.revenue - prevMetrics.revenue,
        changePercent: prevMetrics.revenue > 0 ? ((current.revenue - prevMetrics.revenue) / prevMetrics.revenue) * 100 : 0,
      },
      adr: {
        current: current.adr,
        previous: prevMetrics.adr,
        change: current.adr - prevMetrics.adr,
        changePercent: prevMetrics.adr > 0 ? ((current.adr - prevMetrics.adr) / prevMetrics.adr) * 100 : 0,
      },
      nights: {
        current: current.nights,
        previous: prevMetrics.nights,
        change: current.nights - prevMetrics.nights,
        changePercent: prevMetrics.nights > 0 ? ((current.nights - prevMetrics.nights) / prevMetrics.nights) * 100 : 0,
      },
      occupancy: {
        current: current.occupancy,
        previous: prevMetrics.occupancy,
        change: current.occupancy - prevMetrics.occupancy,
        changePercent: prevMetrics.occupancy > 0 ? ((current.occupancy - prevMetrics.occupancy) / prevMetrics.occupancy) * 100 : 0,
      },
      directShare: {
        current: current.directShare,
        previous: prevMetrics.directShare,
        change: current.directShare - prevMetrics.directShare,
        changePercent: prevMetrics.directShare > 0 ? ((current.directShare - prevMetrics.directShare) / prevMetrics.directShare) * 100 : 0,
      },
      otaShare: {
        current: current.otaShare,
        previous: prevMetrics.otaShare,
        change: current.otaShare - prevMetrics.otaShare,
        changePercent: prevMetrics.otaShare > 0 ? ((current.otaShare - prevMetrics.otaShare) / prevMetrics.otaShare) * 100 : 0,
      },
      commissions: {
        current: current.commissions,
        previous: prevMetrics.commissions,
        change: current.commissions - prevMetrics.commissions,
        changePercent: prevMetrics.commissions > 0 ? ((current.commissions - prevMetrics.commissions) / prevMetrics.commissions) * 100 : 0,
      },
    },
    insights: [],
  };
}

export async function calculateStructureMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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

  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days });
  await engine.init();
  
  const structure = engine.getStructureMetrics();
  const profit = engine.getProfitability();
  
  // Add NRevPAR and GOPPAR which require profitability
  const availableRoomNights = structure.roomCount * days;
  
  const result: StructureMetrics = {
    ...structure,
    NRevPAR: Math.round(availableRoomNights > 0 ? (profit.totalRevenue - profit.totalCommissions) / availableRoomNights : 0),
    GOPPAR: Math.round(availableRoomNights > 0 ? profit.netProfit / availableRoomNights : 0),
    // Rounding for presentation (Issue E)
    occupancyRate: Math.round(structure.occupancyRate * 10) / 10,
    ADR: Math.round(structure.ADR),
    RevPAR: Math.round(structure.RevPAR)
  };

  cacheService.set(cacheKey, result);
  return result;
}

export async function calculateReconciliation(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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

  const totalDebits = await database.sumDebits(propertyId, startStr, endStr);
  const totalCredits = await database.sumCredits(propertyId, startStr, endStr);
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

export async function getARAging(propertyId: string): Promise<any> {
  const cacheKey = `ar-aging-${propertyId}`;
  const cached = cacheService.get<ARAging>(cacheKey);
  if (cached) return cached;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const reservations = await database.getReservationsWithBalance(propertyId);
  
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

export async function calculateBreakEven(propertyId: string): Promise<any> {
  const cacheKey = `breakeven-${propertyId}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return cached;

  const costSettings = await database.getCostSettings(propertyId);
  const roomCount = costSettings?.room_count || 0;
  const fixedMonthly = await database.getTotalMonthlyFixedCosts(propertyId);
  
  const structure = await calculateStructureMetrics(propertyId, 90); 
  const channels = await calculateChannelMetrics(propertyId, 90);
  
  const ADR = structure.ADR;
  const totalRevenue = channels.channels.reduce((sum: number, c: any) => sum + c.revenue, 0);
  const totalCommission = channels.channels.reduce((sum: number, c: any) => sum + c.estimatedCommission, 0);
  const avgComm = totalRevenue > 0 ? totalCommission / totalRevenue : 0;
  
  const estimatedOccupiedNights = (structure.occupancyRate / 100) * roomCount * structure.period.days;
  const { perNightTotal: totalVarPerNight } = getVariableCostPerNight(
    costSettings,
    estimatedOccupiedNights,
    0
  );
  
  const contribPerNight = ADR * (1 - avgComm) - totalVarPerNight;
  
  let breakEvenOccupancy = 0;
  let isImpossible = false;
  
  if (contribPerNight <= 0) {
    breakEvenOccupancy = 100;
    isImpossible = true;
  } else {
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

export async function getCollectionsData(propertyId: string): Promise<any> {
  const totalBalanceDue = await database.getTotalBalanceDue(propertyId);
  const reservations = await database.getReservationsWithBalance(propertyId);
  
  const allReservations = await database.getReservationsByProperty(propertyId);
  const totalPaid = allReservations.reduce((sum: number, r: any) => sum + (r.paid_amount || 0), 0);
  
  return {
    totalBalanceDue,
    totalPaid,
    reservationsWithBalance: reservations.map((r: any) => ({
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

export async function getDepositGaps(propertyId: string): Promise<any> {
  return await database.getDepositGaps(propertyId);
}

export async function getChannelBreakdown(propertyId: string, days: number = 90): Promise<any> {
  return await database.getChannelSummary(propertyId);
}

export async function calculateConfidenceScore(propertyId: string): Promise<any> {
  const costSettings = await database.getCostSettings(propertyId);
  const dataHealth = await database.getDataHealth(propertyId);
  
  const hasRoomCount = (costSettings?.room_count || 0) > 0;
  const hasReservations = dataHealth.hasReservationsFinancials;
  const hasCommissions = costSettings?.channel_commissions && Object.keys(costSettings.channel_commissions.byChannel).length > 0;
  const hasCosts = costSettings?.fixed_costs && calculateTotalFixedCosts(costSettings.fixed_costs) > 0;

  if (!hasRoomCount || !hasReservations) return 'LOW';
  if (!hasCommissions || !hasCosts) return 'MEDIUM';
  return 'HIGH';
}

export async function getProfitabilityMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
  return await calculateProfitabilityMetrics(propertyId, startDateOrDays, endDate);
}

export async function getMinimumPriceSimulation(propertyId: string, marginPct: number): Promise<any> {
  return await calculateMinimumPrice(propertyId, marginPct);
}

export async function getDailyFlow(propertyId: string, days: number = 30): Promise<any> {
  const endDate = new Date().toISOString().substring(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  return await database.getDailyFlow(propertyId, startDate, endDate);
}

export async function calculateDOWPerformance(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): Promise<any> {
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

  const reservations = (await database.getReservationsByProperty(propertyId)).filter((r: any) => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const costSettings = await database.getCostSettings(propertyId);
  const roomCount = costSettings?.room_count || 1;
  const fixedMonthly = await database.getTotalMonthlyFixedCosts(propertyId);
  const fixedPerDay = fixedMonthly / 30.44;

  const dowData: Record<number, { nights: number; revenue: number; resCount: number }> = {};
  for (let i = 0; i < 7; i++) {
    dowData[i] = { nights: 0, revenue: 0, resCount: 0 };
  }

  reservations.forEach((r: any) => {
    const date = new Date(r.check_in);
    const dow = date.getDay();
    dowData[dow].nights += (r.room_nights || 0);
    dowData[dow].revenue += (r.room_revenue_total || 0);
    dowData[dow].resCount += 1;
  });

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
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

export async function calculateYoYComparison(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  
  const prevEnd = new Date(currentEnd);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  const prevStart = new Date(currentStart);
  prevStart.setFullYear(prevStart.getFullYear() - 1);

  const prevStartStr = prevStart.toISOString().substring(0, 10);
  const prevEndStr = prevEnd.toISOString().substring(0, 10);

  const getMetricsForPeriod = async (startStr: string, endStr: string) => {
    const reservations = (await database.getReservationsByProperty(propertyId)).filter((r: any) => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      return checkIn >= startStr && checkIn <= endStr;
    });

    if (reservations.length === 0) return null;

    const revenue = reservations.reduce((sum: number, r: any) => sum + (r.room_revenue_total || 0), 0);
    const nights = reservations.reduce((sum: number, r: any) => sum + (r.room_nights || 0), 0);
    const adr = nights > 0 ? revenue / nights : 0;
    
    const costSettings = await database.getCostSettings(propertyId);
    const roomCount = costSettings?.room_count || 1;
    const occupancy = (nights / (roomCount * days)) * 100;

    return { revenue, adr, occupancy, nights };
  };

  const current = await getMetricsForPeriod(startStr, endStr);
  const previousYear = await getMetricsForPeriod(prevStartStr, prevEndStr);

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
