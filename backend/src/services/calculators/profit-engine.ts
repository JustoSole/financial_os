import database from '../../db';
import { getVariableCostPerNight } from '../costs-utils';

export interface BreakEvenResult {
  period: {
    start: string;
    end: string;
    days: number;
  };
  proratedFixedCosts: number;
  totalVariableCosts: number;
  totalNightsSold: number;
  adr: number;
  totalRevenue: number;
  totalNetProfit: number;
  breakEvenPrice: number;
  requiredNightsFixed: number;
  requiredNightsTotal: number;
  marginOfSafetyNights: number;
  isImpossible: boolean;
  status: 'profit' | 'loss';
}

export function calculateProfitabilityMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): BreakEvenResult {
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
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  
  // 2.2. Motor de Prorrateo de Tiempo
  // ProrratedFixedCosts = MonthlyFixedCosts * (DaysInPeriod / 30.42)
  const daysInMonth = 30.42;
  const proratedFixedCosts = (fixedMonthly * days) / daysInMonth;

  // Get operational data for the period
  const reservations = database.getReservationsByProperty(propertyId).filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const totalNightsSold = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const totalRoomRevenue = reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
  const adr = totalNightsSold > 0 ? totalRoomRevenue / totalNightsSold : 0;

  // Variable costs
  const { perNightBase, cleaningTotal } = getVariableCostPerNight(
    costSettings,
    totalNightsSold,
    reservations.length
  );
  const totalVariableCosts = (totalNightsSold * perNightBase) + cleaningTotal;

  // 3. B. Rentabilidad y Umbrales (Profitability)
  // 6. Break-even Price (Tarifa de Equilibrio): (Prorrated Fixed Costs + Total Variable Costs) / Noches Vendidas
  const breakEvenPrice = totalNightsSold > 0 
    ? (proratedFixedCosts + totalVariableCosts) / totalNightsSold 
    : 0;

  // 7. Required Nights (Noches de Equilibrio)
  // Contribution margin per night = ADR - Variable Cost Per Night
  // We use effective ADR (net of commissions if possible, but playbook says ADR)
  // Let's use net ADR for more accuracy if we want NRevPAR style, but following playbook:
  const variablePerNightAvg = totalNightsSold > 0 ? totalVariableCosts / totalNightsSold : 0;
  const contributionMargin = adr - variablePerNightAvg;

  let requiredNightsFixed = 0;
  let requiredNightsTotal = 0;
  let isImpossible = contributionMargin <= 0;

  if (!isImpossible) {
    // Para cubrir fijos: Prorrated Fixed Costs / (ADR - Variable Cost Per Night)
    requiredNightsFixed = proratedFixedCosts / contributionMargin;
    // Para cubrir costos totales: (Prorrated Fixed Costs + Total Variable Costs) / (ADR - Variable Cost Per Night)
    requiredNightsTotal = (proratedFixedCosts + totalVariableCosts) / contributionMargin;
  } else {
    requiredNightsFixed = 999;
    requiredNightsTotal = 999;
  }

  // 8. Margen de Seguridad
  const marginOfSafetyNights = totalNightsSold - requiredNightsFixed;

  return {
    period: { start: startStr, end: endStr, days },
    proratedFixedCosts: Math.round(proratedFixedCosts),
    totalVariableCosts: Math.round(totalVariableCosts),
    totalNightsSold,
    totalRevenue: Math.round(totalRoomRevenue),
    totalNetProfit: Math.round(totalRoomRevenue - (proratedFixedCosts + totalVariableCosts)),
    adr: Math.round(adr),
    breakEvenPrice: Math.round(breakEvenPrice),
    requiredNightsFixed: Math.round(requiredNightsFixed * 10) / 10,
    requiredNightsTotal: Math.round(requiredNightsTotal * 10) / 10,
    marginOfSafetyNights: Math.round(marginOfSafetyNights * 10) / 10,
    isImpossible,
    status: adr > breakEvenPrice ? 'profit' : 'loss'
  };
}

