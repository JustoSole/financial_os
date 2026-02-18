/**
 * =====================================================
 * Financial OS - Calculation Helpers
 * Centralized formulas for business calculations
 * =====================================================
 */

import type { FixedCostsInput, VariableCostsInput } from '../types/models';

/**
 * Calculates total monthly fixed costs
 */
export function calculateTotalFixedCosts(costs: FixedCostsInput): number {
  return (costs.salaries || 0) + (costs.rent || 0) + (costs.utilities || 0) + (costs.other || 0);
}

/**
 * Calculates variable cost per night from monthly totals
 */
export function calculateVariablePerNight(costs: VariableCostsInput, occupiedNights: number): number {
  if (occupiedNights <= 0) return 0;
  return ((costs.laundryMonthly || 0) + (costs.amenitiesMonthly || 0)) / occupiedNights;
}

/**
 * Calculates total variable cost for a stay
 */
export function calculateVariableCostForStay(
  costs: VariableCostsInput, 
  nights: number, 
  variablePerNight: number
): number {
  return (costs.cleaningPerStay || 0) + (variablePerNight * nights);
}

/**
 * Calculates break-even occupancy percentage (period-based).
 * Use when you have total fixed costs for a period and total available room-nights.
 */
export function calculateBreakEvenOccupancy(
  fixedCostsPerPeriod: number,
  contributionPerNight: number,
  availableNights: number
): number {
  if (contributionPerNight <= 0 || availableNights <= 0) return 100;
  const breakEvenNights = fixedCostsPerPeriod / contributionPerNight;
  return (breakEvenNights / availableNights) * 100;
}

/**
 * Break-even occupancy % from daily figures (single source of truth).
 * Formula: (fixedPerDay / (contribPerNight * roomCount)) * 100
 * - contribPerNight = ADR*(1-commission) - variableCostPerNight
 * Returns 0–100 (capped); 100 when impossible (contribPerNight <= 0 or roomCount <= 0).
 */
export function computeBreakEvenOccupancyPercent(
  fixedPerDay: number,
  contribPerNight: number,
  roomCount: number
): number {
  if (contribPerNight <= 0 || roomCount <= 0) return 100;
  const raw = (fixedPerDay / (contribPerNight * roomCount)) * 100;
  return Math.min(100, Math.max(0, raw));
}

/**
 * Calculates break-even price (minimum ADR to cover costs)
 * Based on capacity to provide a stable pricing floor.
 */
export function calculateBreakEvenPrice(
  totalFixedCosts: number,
  variableCostPerNight: number,
  totalCapacityNights: number,
  commissionRate: number
): number {
  if (totalCapacityNights <= 0) return 0;
  const fixedPerNight = totalFixedCosts / totalCapacityNights;
  return (fixedPerNight + variableCostPerNight) / (1 - commissionRate);
}

/**
 * Calculates profit margin percentage
 */
export function calculateMarginPercent(revenue: number, profit: number): number {
  if (revenue <= 0) return 0;
  return (profit / revenue) * 100;
}

/**
 * Calculates percentage change between two values
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Rounds to specified decimal places
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

