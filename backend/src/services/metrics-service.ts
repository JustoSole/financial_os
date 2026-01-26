import database from '../db';
import cacheService from './cache-service';
import { CalculationEngine } from './calculation-engine';
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
  const cacheKey = `home-v2-${propertyId}-${startDateOrDays}-${endDate || ''}`;
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

  // Usar CalculationEngine para unificar criterios
  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days });
  await engine.init();
  const result = engine.getHomeMetrics();

  cacheService.set(cacheKey, result);
  return result;
}

async function calculateSavingsPotential(propertyId: string): Promise<any> {
  const costSettings = await database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0;
  const overrides = costSettings?.channel_commission_overrides || {};
  
  // Usar un rango de fechas razonable para el ahorro potencial (últimos 30 días)
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().substring(0, 10);
  const endStr = end.toISOString().substring(0, 10);
  
  const channels = await database.getChannelSummary(propertyId, startStr, endStr);
  
  if (channels.length === 0) {
    return {
      value: 0,
      topChannel: '-',
      suggestion: 'Importá el Reservations Report para ver tu ahorro potencial',
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
  
  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days });
  await engine.init();
  const result = await engine.getCashMetrics();

  cacheService.set(cacheKey, result);
  return result;
}

export async function calculateChannelMetrics(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): Promise<any> {
  const cacheKey = `channels-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<ChannelMetrics>(cacheKey);
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
  
  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days });
  await engine.init();
  const result = engine.getChannelMetrics();

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
      const checkOut = r.check_out?.substring(0, 10);
      // Correct inclusive logic for period filtering
      return checkIn <= endStr && checkOut > startStr;
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
  const cashMetrics = await engine.getCashMetrics();
  const profitability = engine.getProfitability();

  const totalDebits = profitability.totalRevenue; // Revenue reconocido
  const totalCredits = cashMetrics.runway.avgNetDaily > 0 ? cashMetrics.dailyFlow.reduce((sum: number, d: any) => sum + d.credits, 0) : 0; // Simplified
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
  const engine = new CalculationEngine(propertyId, { 
    start: new Date().toISOString().substring(0, 10), 
    end: new Date().toISOString().substring(0, 10), 
    days: 30 
  });
  await engine.init();
  const reservations = engine.getReservations();
  
  return reservations
    .filter(r => (Number(r.suggested_deposit) - Number(r.paid_amount)) > 0)
    .map(r => ({
      ...r,
      deposit_gap: Number(r.suggested_deposit) - Number(r.paid_amount),
    }))
    .sort((a, b) => b.deposit_gap - a.deposit_gap);
}

export async function getChannelBreakdown(propertyId: string, days: number = 90): Promise<any> {
  const endDate = new Date().toISOString().substring(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const engine = new CalculationEngine(propertyId, { start: startDate, end: endDate, days });
  await engine.init();
  const channelMetrics = engine.getChannelMetrics();
  return channelMetrics.channels;
}

export async function calculateConfidenceScore(propertyId: string): Promise<any> {
  const engine = new CalculationEngine(propertyId, { 
    start: new Date().toISOString().substring(0, 10), 
    end: new Date().toISOString().substring(0, 10), 
    days: 30 
  });
  await engine.init();
  const dataHealth = engine.getDataHealth();
  const costSettings = await database.getCostSettings(propertyId);
  
  const hasRoomCount = (costSettings?.room_count || 0) > 0;
  const hasReservations = dataHealth.hasReservationsFinancials;
  const hasCommissions = costSettings?.channel_commissions && Object.keys(costSettings.channel_commissions.byChannel).length > 0;
  const hasCosts = costSettings?.fixed_costs && calculateTotalFixedCosts(costSettings.fixed_costs) > 0;

  if (!hasRoomCount || !hasReservations) return 'LOW';
  if (!hasCommissions || !hasCosts) return 'MEDIUM';
  return 'HIGH';
}

export async function getProfitabilityMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  return engine.getProfitability();
}

export async function getMinimumPriceSimulation(propertyId: string, marginPct: number): Promise<any> {
  const engine = new CalculationEngine(propertyId, { 
    start: new Date().toISOString().substring(0, 10), 
    end: new Date().toISOString().substring(0, 10), 
    days: 30 
  });
  await engine.init();
  const profitability = engine.getProfitability();
  const structure = engine.getStructureMetrics();
  
  const totalNights = profitability.totalNights || 1;
  const cpor = profitability.totalCosts / totalNights;
  const minPrice = cpor / (1 - (marginPct / 100));

  return {
    cpor: Math.round(cpor),
    recommendedPrice: Math.round(minPrice),
    marginPct,
    currentAdr: Math.round(structure.ADR)
  };
}

export async function getDailyFlow(propertyId: string, days: number = 30): Promise<any> {
  const endDate = new Date().toISOString().substring(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const engine = new CalculationEngine(propertyId, { start: startDate, end: endDate, days });
  await engine.init();
  const cashMetrics = await engine.getCashMetrics();
  return cashMetrics.dailyFlow;
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
    const checkOut = r.check_out?.substring(0, 10);
    // Unified inclusive logic for period filtering (same as CalculationEngine)
    return checkIn <= endStr && checkOut > startStr;
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
      const checkOut = r.check_out?.substring(0, 10);
      // Correct inclusive logic for period filtering
      return checkIn <= endStr && checkOut > startStr;
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
