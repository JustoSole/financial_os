import database from '../../db';
import { CalculationEngine } from '../calculation-engine';

/**
 * Profit Engine - Break-even Analysis
 */
export async function calculateProfitabilityMetrics(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  
  const profit = engine.getProfitability();

  return {
    period: { start: startStr, end: endStr, days },
    totalRevenue: profit.totalRevenue,
    totalCosts: profit.totalCosts,
    netProfit: profit.netProfit,
    profitMargin: Math.round(profit.marginPercent * 10) / 10,
    breakEvenNights: 0, // Handled in CommandCenter for better context
  };
}
