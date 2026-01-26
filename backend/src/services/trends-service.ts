import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { 
  TrendData,
  TrendPoint,
  DatePeriod
} from '../types';

/**
 * Trends Service - Historical Performance Analysis
 */
export async function calculateTrendMetrics(propertyId: string, months: number = 6): Promise<any> {
  const points: any[] = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStart = d.toISOString().substring(0, 10);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    
    const period: DatePeriod = { start: monthStart, end: monthEnd, days: daysInMonth };
    const engine = new CalculationEngine(propertyId, period);
    await engine.init();
    
    const structure = engine.getStructureMetrics();
    const profit = engine.getProfitability();
    
    points.push({
      date: monthStart.substring(0, 7), // YYYY-MM
      revenue: Math.round(profit.totalRevenue),
      occupancy: Math.round(structure.occupancyRate * 10) / 10,
      adr: Math.round(structure.ADR),
      revpar: Math.round(structure.RevPAR),
      netProfit: Math.round(profit.netProfit)
    });
  }

  return {
    propertyId,
    period: `${months} meses`,
    points
  };
}
