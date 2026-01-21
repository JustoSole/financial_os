/**
 * =====================================================
 * Financial OS - Plan Constants (MVP: free + pro)
 * =====================================================
 */

import type { PlanType } from '../types/enums';

export interface PlanLimits {
  maxProperties: number;
  historyDays: number;        // -1 = unlimited
  alerts: boolean;
  exports: boolean;
  forecast: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxProperties: 1,
    historyDays: 90,
    alerts: true,
    exports: false,
    forecast: false,
  },
  pro: {
    maxProperties: 1,
    historyDays: -1,
    alerts: true,
    exports: true,
    forecast: true,
  },
};

export const PLAN_INFO: Record<PlanType, {
  name: string;
  displayName: string;
  price: number | null;
  priceLabel: string;
  features: string[];
}> = {
  free: {
    name: 'free',
    displayName: 'Free',
    price: 0,
    priceLabel: 'Gratis',
    features: [
      'Últimos 90 días de data',
      'Métricas básicas',
      'Data Health Score',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: 49,
    priceLabel: '$49/mes',
    features: [
      'Historial completo',
      'Proyección de caja',
      'Exports PDF/Excel',
      'Todas las métricas',
    ],
  },
};

export function isPlanFeatureAvailable(plan: PlanType, feature: keyof PlanLimits): boolean {
  const value = PLAN_LIMITS[plan][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return false;
}

export function getAvailablePeriods(plan: PlanType): number[] {
  const { historyDays } = PLAN_LIMITS[plan];
  const allPeriods = [7, 30, 90, 180, 365];
  if (historyDays === -1) return allPeriods;
  return allPeriods.filter(p => p <= historyDays);
}
