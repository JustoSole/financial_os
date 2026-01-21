import database from '../../db';
import { DEFAULT_CHANNEL_COMMISSIONS } from '../../types';
import { getVariableCostPerNight } from '../costs-utils';

export interface MinimumPriceResult {
  marginPct: number;
  avgCommissionRate: number;
  minPrice: number;
  components: {
    fixedCostPerNight: number;
    variableCostPerNight: number;
    markupAmount: number;
    commissionImpact: number;
  };
}

export function calculateMinimumPrice(
  propertyId: string, 
  marginPct: number, 
  startDateOrDays: string | number = 90,
  endDate?: string
): MinimumPriceResult {
  const costSettings = database.getCostSettings(propertyId);
  const fixedMonthly = database.getTotalMonthlyFixedCosts(propertyId);
  const overrides = costSettings?.channel_commissions?.byChannel || {};
  const defaultRate = costSettings?.channel_commissions?.defaultRate || 0.15;

  // 1. Get operational data
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

  const reservations = database.getReservationsByProperty(propertyId).filter(r => {
    if (r.status === 'Cancelled' || r.status === 'No Show') return false;
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= startStr && checkIn <= endStr;
  });

  const totalNightsSold = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
  const totalRoomRevenue = reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);

  // 2. Calculate Weighted Commission Rate
  // AvgCommRate = SUM(RevenueByChannel * CommRateByChannel) / TotalRevenue
  let totalEstimatedCommission = 0;
  
  // Group by channel to calculate weighted rate
  const revenueByChannel: Record<string, number> = {};
  for (const r of reservations) {
    const source = r.source || 'Directo';
    revenueByChannel[source] = (revenueByChannel[source] || 0) + (r.room_revenue_total || 0);
  }

  for (const [source, revenue] of Object.entries(revenueByChannel)) {
    const sourceLower = source.toLowerCase();
    const rate = overrides[sourceLower] || 
                 overrides[source] || 
                 DEFAULT_CHANNEL_COMMISSIONS[sourceLower] || 
                 defaultRate;
    totalEstimatedCommission += revenue * rate;
  }

  const avgCommRate = totalRoomRevenue > 0 ? totalEstimatedCommission / totalRoomRevenue : defaultRate;

  // 3. Fixed and Variable Costs
  const daysInMonth = 30.42;
  const proratedFixedCosts = (fixedMonthly * days) / daysInMonth;
  const fixedCostPerNight = totalNightsSold > 0 ? proratedFixedCosts / totalNightsSold : (fixedMonthly / daysInMonth / (costSettings?.room_count || 1));
  
  const { perNightTotal: totalVarPerNight } = getVariableCostPerNight(
    costSettings,
    totalNightsSold,
    reservations.length
  );

  // 4. Formula: MinPrice = [(ProrratedFixedCosts/NightsSold + VariableCostPerNight) * (1 + MarginPct)] / (1 - AvgCommRate)
  const marginMultiplier = 1 + (marginPct / 100);
  const baseCostPerNight = fixedCostPerNight + totalVarPerNight;
  const minPrice = (baseCostPerNight * marginMultiplier) / (1 - avgCommRate);

  return {
    marginPct,
    avgCommissionRate: Math.round(avgCommRate * 1000) / 1000,
    minPrice: Math.round(minPrice),
    components: {
      fixedCostPerNight: Math.round(fixedCostPerNight),
      variableCostPerNight: Math.round(totalVarPerNight),
      markupAmount: Math.round(baseCostPerNight * (marginPct / 100)),
      commissionImpact: Math.round(minPrice * avgCommRate)
    }
  };
}

