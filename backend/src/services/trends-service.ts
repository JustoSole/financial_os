import database from '../db';
import cacheService from './cache-service';
import { calculateStructureMetrics, calculateHomeMetrics, calculateReconciliation } from './metrics-service';
import { calculateProfitabilityMetrics } from './calculators/profit-engine';

export interface TrendPoint {
  month: string;      // "2025-12"
  label: string;      // "Dic"
  value: number;
}

export interface TrendData {
  months: number;
  revenue: TrendPoint[];
  adr: TrendPoint[];
  occupancy: TrendPoint[];
  revpar: TrendPoint[];
  netProfit: TrendPoint[];
}

export function calculateTrendMetrics(propertyId: string, months: number = 6): TrendData {
  const cacheKey = `trends-${propertyId}-${months}`;
  const cached = cacheService.get<TrendData>(cacheKey);
  if (cached) return cached;

  const result: TrendData = {
    months,
    revenue: [],
    adr: [],
    occupancy: [],
    revpar: [],
    netProfit: [],
  };

  const now = new Date();
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Calculate for the last N months
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    
    const startStr = monthStart.toISOString().substring(0, 10);
    const endStr = monthEnd.toISOString().substring(0, 10);
    const monthLabel = monthNames[d.getMonth()];
    const monthKey = startStr.substring(0, 7);

    // Get metrics for this specific month
    const structure = calculateStructureMetrics(propertyId, startStr, endStr);
    const profitability = calculateProfitabilityMetrics(propertyId, startStr, endStr);
    const home = calculateHomeMetrics(propertyId, startStr, endStr);

    result.revenue.push({ month: monthKey, label: monthLabel, value: profitability.totalNightsSold * profitability.adr });
    result.adr.push({ month: monthKey, label: monthLabel, value: structure.ADR });
    result.occupancy.push({ month: monthKey, label: monthLabel, value: structure.occupancyRate });
    result.revpar.push({ month: monthKey, label: monthLabel, value: structure.RevPAR });
    result.netProfit.push({ month: monthKey, label: monthLabel, value: profitability.status === 'profit' ? (profitability.totalNightsSold * (profitability.adr - profitability.breakEvenPrice)) : -(profitability.proratedFixedCosts + profitability.totalVariableCosts - (profitability.totalNightsSold * profitability.adr)) });
  }

  cacheService.set(cacheKey, result);
  return result;
}

export default { calculateTrendMetrics };

