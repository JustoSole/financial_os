import database from '../db';
import { getConfidenceBand } from '@financial-os/shared';
import type { MonthlyCloseCheck } from '@financial-os/shared';

const COVERAGE_THRESHOLD = 0.95;

/**
 * Builds the list of checks for a given month: required and recommended.
 * Uses actual data from DB to determine pass/fail.
 */
export async function calculateMonthlyChecks(
  propertyId: string,
  month: string
): Promise<MonthlyCloseCheck[]> {
  const checks: MonthlyCloseCheck[] = [];

  // Date range for the month
  const [year, mo] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  const daysInMonth = lastDay;

  // Check transactions coverage
  const transactions = await database.getTransactionsByProperty(propertyId, startDate, endDate);
  const txnDays = new Set(transactions.map(t => t.txn_at?.substring(0, 10))).size;
  const txnCoverage = daysInMonth > 0 ? txnDays / daysInMonth : 0;
  checks.push({
    key: 'transactions_coverage',
    label: 'Transacciones del mes',
    type: 'required',
    passed: txnCoverage >= COVERAGE_THRESHOLD,
    detail: `${txnDays}/${daysInMonth} días con datos (${Math.round(txnCoverage * 100)}%)`,
  });

  // Check reservations coverage
  const reservationCount = await database.countReservationsForMonth(propertyId, startDate, endDate);
  const hasReservations = reservationCount > 0;
  checks.push({
    key: 'reservations_coverage',
    label: 'Reservas del mes',
    type: 'required',
    passed: hasReservations,
    detail: hasReservations ? `${reservationCount} reservas` : 'Sin reservas importadas',
  });

  // Check monthly costs loaded
  const monthlyCosts = await database.getMonthlyCosts(propertyId, month);
  const hasCosts = monthlyCosts.length > 0;
  checks.push({
    key: 'costs_loaded',
    label: 'Costos del mes cargados',
    type: 'required',
    passed: hasCosts,
    detail: hasCosts ? `${monthlyCosts.length} categorías` : 'Sin costos mensuales',
  });

  // Recommended: cash balance
  const cashBalance = await database.getMonthlyCashBalance(propertyId, month);
  checks.push({
    key: 'cash_balance',
    label: 'Saldo de caja del mes',
    type: 'recommended',
    passed: cashBalance !== null,
    detail: cashBalance ? `$${Number(cashBalance.balance).toLocaleString()}` : 'No registrado',
  });

  return checks;
}

/**
 * Calculates the confidence score for a month based on checks.
 * Formula from the plan: starts at 100, deducts per failed check.
 */
export function calculateConfidenceScore(checks: MonthlyCloseCheck[]): number {
  let score = 100;

  const checkMap = Object.fromEntries(checks.map(c => [c.key, c]));

  if (!checkMap.transactions_coverage?.passed) score -= 30;
  if (!checkMap.reservations_coverage?.passed) score -= 30;
  if (!checkMap.costs_loaded?.passed) score -= 25;
  if (!checkMap.cash_balance?.passed) score -= 10;

  return Math.max(0, score);
}

/**
 * Determine if the month can be closed, and with what status.
 * Returns null if required checks fail (can't close).
 */
export function resolveCloseStatus(checks: MonthlyCloseCheck[]): 'closed' | 'closed_with_warnings' | null {
  const requiredFailed = checks.filter(c => c.type === 'required' && !c.passed);
  if (requiredFailed.length > 0) return null;

  const recommendedFailed = checks.filter(c => c.type === 'recommended' && !c.passed);
  return recommendedFailed.length > 0 ? 'closed_with_warnings' : 'closed';
}

/**
 * Open (or ensure open) a monthly period.
 */
export async function openMonthlyPeriod(propertyId: string, month: string) {
  return database.getOrCreateMonthlyPeriod(propertyId, month);
}

/**
 * Close a monthly period. Calculates checks and score, fails if required checks not met.
 */
export async function closeMonthlyPeriod(propertyId: string, month: string, userId?: string) {
  const period = await database.getOrCreateMonthlyPeriod(propertyId, month);

  if (period.status === 'closed' || period.status === 'closed_with_warnings') {
    return { period, checks: [], alreadyClosed: true };
  }

  const checks = await calculateMonthlyChecks(propertyId, month);
  const closeStatus = resolveCloseStatus(checks);

  if (!closeStatus) {
    const failedRequired = checks.filter(c => c.type === 'required' && !c.passed);
    return {
      period,
      checks,
      error: `Faltan requisitos: ${failedRequired.map(c => c.label).join(', ')}`,
    };
  }

  const score = calculateConfidenceScore(checks);

  const updated = await database.updateMonthlyPeriod(propertyId, month, {
    status: closeStatus,
    confidence_score: score,
    checks_json: checks,
    closed_at: new Date().toISOString(),
    closed_by: userId || null,
  });

  return { period: updated, checks, score, alreadyClosed: false };
}

/**
 * Reopen a closed monthly period.
 */
export async function reopenMonthlyPeriod(propertyId: string, month: string, userId?: string) {
  const period = await database.getOrCreateMonthlyPeriod(propertyId, month);

  if (period.status === 'open') {
    return { period, alreadyOpen: true };
  }

  const updated = await database.updateMonthlyPeriod(propertyId, month, {
    status: 'open',
    closed_at: null,
    closed_by: null,
    updated_by: userId || null,
  });

  return { period: updated, alreadyOpen: false };
}

/**
 * Get full close detail for a month: period, checks, costs, cash balance.
 */
export async function getMonthlyCloseDetail(propertyId: string, month: string) {
  const period = await database.getOrCreateMonthlyPeriod(propertyId, month);
  const checks = await calculateMonthlyChecks(propertyId, month);
  const score = calculateConfidenceScore(checks);
  const costs = await database.getMonthlyCosts(propertyId, month);
  const cashBalance = await database.getMonthlyCashBalance(propertyId, month);

  return {
    month,
    status: period.status,
    confidenceScore: score,
    confidenceBand: getConfidenceBand(score),
    checks,
    costs: costs.map((c: any) => ({
      categoryKey: c.category_key,
      displayName: c.cost_categories?.display_name || c.category_key,
      costType: c.cost_type,
      amount: Number(c.amount),
      source: c.source,
    })),
    cashBalance: cashBalance ? Number(cashBalance.balance) : null,
    closedAt: period.closed_at,
  };
}

/**
 * Resolves cost context for a given month with fallback to legacy cost_settings.
 * Used by metrics services to get cost data regardless of which system has it.
 */
export async function resolveCostContext(propertyId: string, month?: string) {
  if (month) {
    const monthlyCosts = await database.getMonthlyCosts(propertyId, month);
    if (monthlyCosts.length > 0) {
      let totalFixed = 0;
      let totalVariable = 0;
      for (const c of monthlyCosts) {
        const amount = Number(c.amount) || 0;
        if (c.cost_type === 'fixed') totalFixed += amount;
        if (c.cost_type === 'variable') totalVariable += amount;
      }
      return {
        source: 'monthly' as const,
        month,
        totalFixed,
        totalVariable,
        entries: monthlyCosts,
      };
    }
  }

  // Fallback to legacy cost_settings
  const settings = await database.getCostSettings(propertyId);
  if (!settings) {
    return { source: 'fallback' as const, month, totalFixed: 0, totalVariable: 0, entries: [] };
  }

  let totalFixed = 0;
  let totalVariable = 0;

  if (settings.fixed_categories?.length > 0) {
    totalFixed = settings.fixed_categories.reduce((s: number, c: any) => s + (Number(c.monthlyAmount) || 0), 0);
  } else if (settings.fixed_costs) {
    totalFixed = (settings.fixed_costs.salaries || 0) + (settings.fixed_costs.rent || 0) +
      (settings.fixed_costs.utilities || 0) + (settings.fixed_costs.other || 0);
  }

  if (settings.variable_categories?.length > 0) {
    totalVariable = settings.variable_categories.reduce((s: number, c: any) => s + (Number(c.monthlyAmount) || 0), 0);
  } else if (settings.variable_costs) {
    totalVariable = (settings.variable_costs.cleaningPerStay || 0) +
      (settings.variable_costs.laundryMonthly || 0) + (settings.variable_costs.amenitiesMonthly || 0);
  }

  return { source: 'fallback' as const, month, totalFixed, totalVariable, entries: [] };
}
