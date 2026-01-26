import { 
  DEFAULT_CHANNEL_COMMISSIONS,
} from '../../types';
import database from '../../db';
import { CalculationEngine } from '../calculation-engine';

/**
 * Pricing Engine - Minimum Price Simulation
 */
export async function calculateMinimumPrice(propertyId: string, marginPct: number): Promise<any> {
  const period = { 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    end: new Date().toISOString().substring(0, 10),
    days: 30
  };

  const engine = new CalculationEngine(propertyId, period);
  await engine.init();
  
  const profit = engine.getProfitability();
  const structure = engine.getStructureMetrics();
  const costs = engine.getCostBreakdown(profit.totalNights);

  const roomCount = structure.roomCount || 1;
  const fixedPerDay = costs.fixedPerDay;
  const fixedPerRoom = fixedPerDay / roomCount;
  const variablePerNight = costs.variablePerNight;
  const baseCost = variablePerNight + fixedPerRoom;

  const reservations = await database.getReservationsByProperty(propertyId);
  const activeReservations = reservations.filter((r: any) => r.status !== 'Cancelled');
  const channels = Array.from(new Set(activeReservations.map((r: any) => r.source || 'Directo')));

  const simulations = channels.map(channel => {
    const channelLower = channel.toLowerCase();
    const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(channelLower);
    
    // Usar la misma lógica de comisión que el engine
    const defaultRate = engine['costSettings']?.channel_commissions?.defaultRate || 0;
    const overrides = engine['costSettings']?.channel_commissions?.byChannel || {};
    const commissionRate = isDirect ? 0 : (overrides[channelLower] || DEFAULT_CHANNEL_COMMISSIONS[channelLower] || defaultRate);
    
    const minPrice = (baseCost * (1 + marginPct / 100)) / (1 - commissionRate);

    return {
      channel,
      commissionRate,
      minPrice: Math.round(minPrice),
      baseCost: Math.round(baseCost),
      marginAmount: Math.round(minPrice * (1 - commissionRate) - baseCost),
    };
  });

  const avgCommissionRate = simulations.length > 0 
    ? simulations.reduce((sum, s) => sum + s.commissionRate, 0) / simulations.length 
    : defaultRate;

  const minPriceAvg = (baseCost * (1 + marginPct / 100)) / (1 - avgCommissionRate);

  return {
    baseCost: Math.round(baseCost),
    variablePerNight: Math.round(variablePerNight),
    fixedPerRoom: Math.round(fixedPerRoom),
    marginPct,
    avgCommissionRate,
    minPrice: Math.round(minPriceAvg),
    components: {
      fixedCostPerNight: Math.round(fixedPerRoom),
      variableCostPerNight: Math.round(variablePerNight),
      markupAmount: Math.round(minPriceAvg * (marginPct / 100)),
      commissionImpact: Math.round(minPriceAvg * avgCommissionRate)
    },
    simulations: simulations.sort((a, b) => a.minPrice - b.minPrice),
  };
}
