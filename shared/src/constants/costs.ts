/**
 * =====================================================
 * Financial OS - Cost & Operational Constants
 * Single source of truth for operational defaults
 * =====================================================
 */

export const DAYS_PER_MONTH = 30.44;

/** Reservation statuses that should be excluded from calculations (case-insensitive) */
export const EXCLUDED_RESERVATION_STATUSES = new Set(['cancelled', 'no show']);

/** Check if a reservation status should be excluded (case-insensitive) */
export function isExcludedStatus(status: unknown): boolean {
  return EXCLUDED_RESERVATION_STATUSES.has(String(status || '').trim().toLowerCase());
}

/** Default cost categories shown when the backend hasn't returned any */
export const DEFAULT_COST_CATEGORIES: Array<{
  categoryKey: string;
  displayName: string;
  costTypeDefault: 'fixed' | 'variable';
  sortOrder: number;
}> = [
  { categoryKey: 'salaries', displayName: 'Sueldos', costTypeDefault: 'fixed', sortOrder: 10 },
  { categoryKey: 'rent', displayName: 'Alquiler', costTypeDefault: 'fixed', sortOrder: 20 },
  { categoryKey: 'utilities', displayName: 'Servicios (luz, gas, agua)', costTypeDefault: 'fixed', sortOrder: 30 },
  { categoryKey: 'software', displayName: 'Software (PMS, etc)', costTypeDefault: 'fixed', sortOrder: 40 },
  { categoryKey: 'insurance', displayName: 'Seguros', costTypeDefault: 'fixed', sortOrder: 50 },
  { categoryKey: 'maintenance', displayName: 'Mantenimiento', costTypeDefault: 'fixed', sortOrder: 60 },
  { categoryKey: 'laundry', displayName: 'Lavandería', costTypeDefault: 'variable', sortOrder: 70 },
  { categoryKey: 'amenities', displayName: 'Amenities', costTypeDefault: 'variable', sortOrder: 80 },
  { categoryKey: 'supplies', displayName: 'Insumos', costTypeDefault: 'variable', sortOrder: 90 },
  { categoryKey: 'cleaning', displayName: 'Limpieza por estadía', costTypeDefault: 'variable', sortOrder: 95 },
  { categoryKey: 'marketing', displayName: 'Marketing', costTypeDefault: 'fixed', sortOrder: 100 },
];

/** Default room count used as fallback when not configured */
export const DEFAULT_ROOM_COUNT = 1;
