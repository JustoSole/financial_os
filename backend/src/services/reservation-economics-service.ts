import database from '../db';
import { CalculationEngine, CalculationEngineOptions } from './calculation-engine';
import { 
  ReservationEconomics,
  ReservationEconomicsSummary,
  DatePeriod
} from '../types';

/**
 * Reservation Economics Service - Unit Economics per Reservation
 * Now uses CalculationEngine as the single source of truth.
 * 
 * NOTA: Retorna información sobre el período efectivo usado para que el frontend
 * pueda detectar si los datos corresponden al período seleccionado o a un fallback histórico.
 */
export async function calculateReservationEconomicsSummary(
  propertyId: string, 
  startDateOrDays: string | number = 30, 
  endDate?: string,
  options?: CalculationEngineOptions
): Promise<any> {
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

  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days }, options);
  await engine.init();
  
  const summary = engine.getReservationEconomicsSummary();
  
  // Agregar información sobre el período para que el frontend pueda verificar
  return {
    ...summary,
    requestedPeriod: { start: startStr, end: endStr, days },
    effectivePeriod: engine.getEffectivePeriod(),
    usedFallbackPeriod: engine.isUsingFallbackPeriod()
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

  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days });
  await engine.init();
  return engine.getReservationEconomicsList(filters);
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
