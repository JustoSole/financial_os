import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { 
  ReservationEconomics,
  ReservationEconomicsSummary,
  DatePeriod
} from '../types';

/**
 * Reservation Economics Service - Unit Economics per Reservation
 * Now uses CalculationEngine as the single source of truth.
 */
export async function calculateReservationEconomicsSummary(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
  const economics = await getReservationEconomicsList(propertyId, startDateOrDays, endDate);
  
  if (economics.length === 0) {
    return {
      totalReservations: 0,
      avgProfitPerReservation: 0,
      unprofitableCount: 0,
      patterns: [],
      worstReservations: []
    };
  }

  const totalProfit = economics.reduce((sum: number, r: any) => sum + r.netProfit, 0);
  const totalRevenue = economics.reduce((sum: number, r: any) => sum + r.revenue, 0);
  const totalNights = economics.reduce((sum: number, r: any) => sum + (r.roomNights || 0), 0);
  const unprofitable = economics.filter((r: any) => r.netProfit < 0);

  const engine = new CalculationEngine(propertyId, { 
    start: startStr,
    end: endStr,
    days: days
  });
  await engine.init();
  const profitability = engine.getProfitability();
  const costSettings = await database.getCostSettings(propertyId);
  const fixedMonthly = await database.getTotalMonthlyFixedCosts(propertyId);

  return {
    totalReservations: economics.length,
    totalRoomNights: totalNights,
    totalRevenue,
    totalNetProfit: totalProfit,
    avgMarginPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    avgProfitPerNight: totalNights > 0 ? totalProfit / totalNights : 0,
    unprofitableCount: unprofitable.length,
    unprofitableShare: (unprofitable.length / economics.length) * 100,
    unprofitableLoss: Math.abs(unprofitable.reduce((sum: number, r: any) => sum + r.netProfit, 0)),
    goppar: profitability.netProfit / (economics.length || 1), // Simplified GOPPAR for this view
    patterns: [], 
    worstReservations: economics.sort((a: any, b: any) => a.netProfit - b.netProfit).slice(0, 10),
    bestReservations: economics.sort((a: any, b: any) => b.netProfit - a.netProfit).slice(0, 10),
    lowConfidenceShare: 0,
    configUsed: {
      variableCostPerNight: Math.round(profitability.totalCosts / (totalNights || 1)), // Estimated
      monthlyFixedCosts: fixedMonthly,
      defaultCommissionRate: costSettings?.channel_commissions?.defaultRate || 0
    }
  };
}

export async function getReservationEconomicsList(propertyId: string, startDateOrDays: string | number = 30, endDate?: string, filters?: any): Promise<any[]> {
  let startStr: string;
  let endStr: string;
  let days: number;

  if (typeof startDateOrDays === 'string' && endDate) {
    startStr = startDateOrDays;
    endStr = endDate;
    const start = new Date(startStr);
    const end = new Date(endStr);
    days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  } else {
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }

  const period: DatePeriod = { start: startStr, end: endStr, days };
  const engine = new CalculationEngine(propertyId, period);
  await engine.init();

  const filtered = engine.getReservations().filter((r: any) => {
    if (filters?.source && r.source !== filters.source) return false;
    return true;
  });

  const economics = filtered.map((r: any) => {
    const econ = engine.calculateReservationEconomics(r);
    return {
      ...econ,
      // Rounding for presentation as requested in Issue E (only at the end)
      fixedAllocated: Math.round(econ.fixedAllocated),
      variableCosts: Math.round(econ.variableCosts),
      totalCosts: Math.round(econ.totalCosts),
      netProfit: Math.round(econ.netProfit),
      profitPerNight: Math.round(econ.profitPerNight),
      profitMargin: Math.round(econ.profitMargin),
      trust: 'real',
      confidence: 'high'
    };
  });

  if (filters?.unprofitableOnly) {
    return economics.filter(e => e.netProfit < 0);
  }

  return economics;
}

export async function getReservationEconomicsDetail(propertyId: string, reservationNumber: string): Promise<any> {
  const allReservations = await database.getReservationsByProperty(propertyId);
  const r = allReservations.find((res: any) => res.reservation_number === reservationNumber);
  
  if (!r) return null;

  // For a single reservation, we use a wide period or just the reservation's own dates
  const period: DatePeriod = { 
    start: r.check_in.substring(0, 10), 
    end: r.check_in.substring(0, 10), 
    days: 1 
  };
  
  const engine = new CalculationEngine(propertyId, period);
  await engine.init();
  
  const econ = engine.calculateReservationEconomics(r);

  return {
    ...econ,
    checkOut: r.check_out,
    fixedAllocated: Math.round(econ.fixedAllocated),
    variableCosts: Math.round(econ.variableCosts),
    totalCosts: Math.round(econ.totalCosts),
    netProfit: Math.round(econ.netProfit),
    profitPerNight: Math.round(econ.profitPerNight),
    profitMargin: Math.round(econ.profitMargin),
    trust: 'real',
    confidence: 'high'
  };
}
