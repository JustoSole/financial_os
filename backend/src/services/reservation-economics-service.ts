import database from '../db';
import cacheService from './cache-service';
import { CalculationEngine, CalculationEngineOptions } from './calculation-engine';
import { 
  ReservationEconomics,
  ReservationEconomicsSummary,
  DatePeriod
} from '../types';

/**
 * Build cost_settings from monthly_cost_entries for the given month so P&L uses loaded costs.
 * Aggregates fixed and variable entries only; extraordinary entries are not included in P&L totals.
 */
async function buildCostSettingsForMonth(propertyId: string, month: string): Promise<any | null> {
  const entries = await database.getMonthlyCosts(propertyId, month);
  if (!entries || entries.length === 0) return null;
  const fixedTotal = entries
    .filter((e: any) => e.cost_type === 'fixed')
    .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const variableTotal = entries
    .filter((e: any) => e.cost_type === 'variable')
    .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const settings = await database.getCostSettings(propertyId);
  if (!settings) return null;
  return {
    ...settings,
    fixed_costs: {
      salaries: 0,
      rent: 0,
      utilities: 0,
      other: fixedTotal,
    },
    variable_categories: [{ categoryKey: 'aggregate', monthlyAmount: variableTotal }],
    variable_costs: {
      cleaningPerStay: settings?.variable_costs?.cleaningPerStay ?? 0,
      laundryMonthly: variableTotal,
      amenitiesMonthly: 0,
    },
  };
}

/**
 * Reservation Economics Service - Unit Economics per Reservation
 * Now uses CalculationEngine as the single source of truth.
 * When start/end fall within a single month, uses monthly_cost_entries for that month so
 * Control financiero P&L reflects the costs loaded in "Cargar costos".
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

  const cacheKey = `res-econ-summary-${propertyId}-${startStr}-${endStr}`;
  const cached = cacheService.get<any>(cacheKey);
  if (cached) return cached;

  const month = startStr.slice(0, 7);
  const preloadedCostSettings = await buildCostSettingsForMonth(propertyId, month);
  const engineOptions: CalculationEngineOptions = preloadedCostSettings
    ? { ...(options ?? {}), preloadedCostSettings, preloadedImportFiles: [] }
    : (options ?? {});

  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days }, engineOptions);
  await engine.init();
  
  const summary = engine.getReservationEconomicsSummary();
  
  const result = {
    ...summary,
    requestedPeriod: { start: startStr, end: endStr, days },
    effectivePeriod: engine.getEffectivePeriod(),
    usedFallbackPeriod: engine.isUsingFallbackPeriod()
  };
  cacheService.set(cacheKey, result);
  return result;
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

  const cacheKey = `res-econ-list-${propertyId}-${startStr}-${endStr}`;
  const cached = cacheService.get<any[]>(cacheKey);
  if (cached) return cached;

  const month = startStr.slice(0, 7);
  const preloadedCostSettings = await buildCostSettingsForMonth(propertyId, month);
  const engineOptions: CalculationEngineOptions = preloadedCostSettings
    ? { preloadedCostSettings, preloadedImportFiles: [] }
    : ({} as CalculationEngineOptions);

  const engine = new CalculationEngine(propertyId, { start: startStr, end: endStr, days }, engineOptions);
  await engine.init();
  const list = engine.getReservationEconomicsList(filters);
  cacheService.set(cacheKey, list);
  return list;
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
