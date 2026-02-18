// =====================================================
// API Client - Simple fetch wrapper for Financial OS MVS
// Timeout, cancellation (AbortSignal), retry for transient errors
// =====================================================
import { supabase } from './lib/supabase';

const API_BASE = (import.meta as any).env.VITE_API_URL || '/api';

const DEFAULT_TIMEOUT_MS = 28000;
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 800;

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAuthToken(): Promise<string | null> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const { data: { session } } = await supabase.auth.getSession();
  _cachedToken = session?.access_token ?? null;
  _tokenExpiry = Date.now() + 4 * 60 * 1000;
  return _cachedToken;
}

supabase.auth.onAuthStateChange(() => {
  _cachedToken = null;
  _tokenExpiry = 0;
});

export type ApiErrorCode = 'timeout' | 'network' | 'auth' | 'server' | 'unknown';

export interface RequestResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ApiErrorCode;
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

function isRetryable(code: ApiErrorCode, status?: number): boolean {
  if (code === 'network') return true;
  if (code === 'server' && status != null && status >= 500) return true;
  return false;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<RequestResult<T>> {
  const { signal: userSignal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES, ...init } = options;
  let lastCode: ApiErrorCode = 'unknown';
  let lastStatus: number | undefined;
  let lastMessage = 'Error de conexión';

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    let removeUserAbort: (() => void) | undefined;
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timeoutId);
        return { success: false, error: 'Cancelado', errorCode: 'unknown' };
      }
      const onUserAbort = () => timeoutController.abort();
      userSignal.addEventListener('abort', onUserAbort);
      removeUserAbort = () => userSignal.removeEventListener('abort', onUserAbort);
    }

    try {
      const token = await getAuthToken();
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
        ...init,
        signal: timeoutController.signal,
      });

      clearTimeout(timeoutId);
      removeUserAbort?.();
      lastStatus = response.status;

      const raw = await response.text();
      let json: RequestResult<T> & { success?: boolean };
      try {
        json = raw ? JSON.parse(raw) : { success: response.ok };
      } catch {
        json = { success: response.ok, error: raw || `HTTP ${response.status}` };
      }

      if (response.status === 401) {
        removeUserAbort?.();
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }
        return {
          success: false,
          error: (json as any).error || 'Sesión expirada',
          errorCode: 'auth',
        };
      }

      if (!response.ok) {
        removeUserAbort?.();
        lastCode = response.status >= 500 ? 'server' : 'unknown';
        lastMessage = (json as any).error || raw || `HTTP ${response.status}`;
        if (isRetryable(lastCode, response.status) && attempt < retries) continue;
        return {
          success: false,
          error: lastMessage,
          errorCode: lastCode,
        };
      }

      removeUserAbort?.();
      return { ...json, success: json.success !== false } as RequestResult<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      removeUserAbort?.();
      if (error?.name === 'AbortError') {
        lastCode = 'timeout';
        lastMessage = 'La solicitud tardó demasiado. Reintentá.';
      } else {
        lastCode = 'network';
        lastMessage = error?.message || 'Error de conexión. Revisá tu red.';
      }
      if (isRetryable(lastCode, lastStatus) && attempt < retries) continue;
      return { success: false, error: lastMessage, errorCode: lastCode };
    }
  }

  return { success: false, error: lastMessage, errorCode: lastCode };
}

// =====================================================
// Property
// =====================================================
export const getProperty = () => request<any>('/property');
export const updateProperty = (id: string, data: any) =>
  request<any>(`/property/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// =====================================================
// Metrics (Section 7 PRD)
// =====================================================
// Home metrics: Cobrado, Cargado, Pendiente, Ahorro potencial
export const getMetrics = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}?${params}`);
};

// Cash metrics: Runway, daily flow, alerts
export const getCashMetrics = (propertyId: string, startDateOrDays: string | number = 90, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/cash?${params}`);
};

// Channel metrics: Donut, dependency, savings potential
export const getChannels = (propertyId: string, startDateOrDays: string | number = 90, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/channels?${params}`);
};

// Collections: Reservations with balance due
export const getCollections = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/collections?${params}`);
};

// Daily flow for chart
export const getDailyFlow = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any[]>(`/metrics/${propertyId}/daily-flow?${params}`);
};

// NEW: Revenue projection (future bookings)
export const getRevenueProjection = (propertyId: string, weeks: number = 4) =>
  request<any>(`/metrics/${propertyId}/projection?weeks=${weeks}`);

// NEW: Period comparison (this month vs previous)
export const getPeriodComparison = (propertyId: string) =>
  request<any>(`/metrics/${propertyId}/comparison`);

// NEW: Get structure metrics (Occupancy, ADR, RevPAR, GOPPAR)
export const getStructureMetrics = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/structure?${params}`);
};

// NEW: Get reconciliation metrics (Charged vs Collected)
export const getReconciliation = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/reconcile?${params}`);
};

// NEW: Get A/R aging
export const getARAging = (propertyId: string) =>
  request<any>(`/metrics/${propertyId}/ar-aging`);

// NEW: Get break-even metrics
export const getBreakEven = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/breakeven?${params}`);
};

// NEW: Get minimum price simulation
export const getMinimumPrice = (propertyId: string, margin: number) =>
  request<any>(`/metrics/${propertyId}/minimum-price?margin=${margin}`);

// NEW: Intelligent insights for home dashboard
export const getInsights = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/insights?${params}`);
};

// NEW: Command Center - All key metrics for 40 essential questions
export const getCommandCenter = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/command-center?${params}`);
};

// NEW: Day of week performance
export const getDOWPerformance = (propertyId: string, startDateOrDays: string | number = 90, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any[]>(`/metrics/${propertyId}/dow?${params}`);
};

// NEW: Get trends
export const getTrends = (propertyId: string, months: number = 6) =>
  request<any>(`/metrics/${propertyId}/trends?months=${months}`);

// NEW: Year over year comparison
export const getYoYComparison = (propertyId: string) =>
  request<any>(`/metrics/${propertyId}/yoy`);

// NEW: Get projections data (OTB + Pacing)
export const getProjections = (propertyId: string, horizon: number = 90) =>
  request<any>(`/metrics/${propertyId}/projections?horizon=${horizon}`);

// =====================================================
// Reservation Economics (P&L por reserva)
// =====================================================
export const getReservationEconomics = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any>(`/metrics/${propertyId}/reservation-economics?${params}`);
};

export const getReservationEconomicsList = (
  propertyId: string, 
  startDateOrDays: string | number = 30,
  endDateOrFilters?: string | { source?: string; nightsBucket?: '1' | '2' | '3+'; unprofitableOnly?: boolean },
  filters?: { source?: string; nightsBucket?: '1' | '2' | '3+'; unprofitableOnly?: boolean }
) => {
  let params: URLSearchParams;
  let actualFilters = filters;

  if (typeof startDateOrDays === 'string' && typeof endDateOrFilters === 'string') {
    params = new URLSearchParams({ startDate: startDateOrDays, endDate: endDateOrFilters });
  } else {
    params = new URLSearchParams({ days: startDateOrDays.toString() });
    actualFilters = endDateOrFilters as any;
  }

  if (actualFilters?.source) params.append('source', actualFilters.source);
  if (actualFilters?.nightsBucket) params.append('nightsBucket', actualFilters.nightsBucket);
  if (actualFilters?.unprofitableOnly) params.append('unprofitableOnly', 'true');
  return request<any[]>(`/metrics/${propertyId}/reservation-economics/list?${params}`);
};

export const getReservationEconomicsDetail = (propertyId: string, reservationNumber: string) =>
  request<any>(`/metrics/${propertyId}/reservation-economics/${encodeURIComponent(reservationNumber)}`);

export const getUnprofitableReservations = (propertyId: string, days: number = 30) =>
  request<any[]>(`/metrics/${propertyId}/unprofitable?days=${days}`);

// =====================================================
// Actions (Section 8 PRD)
// =====================================================
export const getActions = (propertyId: string, startDateOrDays: string | number = 30, endDate?: string) => {
  const params = typeof startDateOrDays === 'string' && endDate
    ? new URLSearchParams({ startDate: startDateOrDays, endDate })
    : new URLSearchParams({ days: startDateOrDays.toString() });
  return request<any[]>(`/actions/${propertyId}?${params}`);
};

// Get all completed steps (for frontend-generated actions) and whole-action status
export const getCompletedSteps = (propertyId: string, daysBack: number = 90) =>
  request<{
    byActionType: Record<string, number[]>;
    byActionId: Record<string, string[]>;
    actionStatus?: Record<string, { status: 'done' | 'dismissed'; completedAt: string }>;
  }>(`/actions/${propertyId}/completed?daysBack=${daysBack}`);

// Set whole-action status (done | dismissed)
export const setActionStatus = (
  propertyId: string,
  actionId: string,
  status: 'done' | 'dismissed'
) =>
  request<void>(`/actions/${propertyId}/status`, {
    method: 'POST',
    body: JSON.stringify({ actionId, status }),
  });

// Complete an action step - supports both formats
// New format: actionId + stepId (strings) - for frontend-generated actions
// Legacy format: actionType + stepIndex (number) - for backend-generated actions
export const completeActionStep = (
  propertyId: string, 
  actionIdOrType: string, 
  stepIdOrIndex: string | number
) =>
  request<void>(`/actions/${propertyId}/step`, {
    method: 'POST',
    body: JSON.stringify(
      typeof stepIdOrIndex === 'string' 
        ? { actionId: actionIdOrType, stepId: stepIdOrIndex }
        : { actionType: actionIdOrType, stepIndex: stepIdOrIndex }
    ),
  });

// =====================================================
// Import (Section 4 PRD)
// =====================================================
export const validateFile = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = `${API_BASE}/import/validate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[validateFile] HTTP error:', response.status, errorText);
      return { success: false, error: `Error HTTP ${response.status}` };
    }

    return response.json();
  } catch (error: any) {
    console.error('[validateFile] Network error:', error);
    return { success: false, error: error.message || 'Error de conexión al servidor' };
  }
};

export const importFile = async (propertyId: string, file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('propertyId', propertyId);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = `${API_BASE}/import`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[importFile] HTTP error:', response.status, errorText);
      return { success: false, error: `Error HTTP ${response.status}` };
    }

    const result = await response.json();
    // Normalize response: check both outer and inner success
    return {
      success: result.success && (result.data?.success !== false),
      data: result.data,
      error: result.error || result.data?.error
    };
  } catch (error: any) {
    console.error('[importFile] Network error:', error);
    return { success: false, error: error.message || 'Error de conexión al servidor' };
  }
};

export const importFiles = async (propertyId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('propertyId', propertyId);

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const url = `${API_BASE}/import/batch`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  return response.json();
};

export const getImportHistory = (propertyId: string) =>
  request<any[]>(`/import/history/${propertyId}`);

// Admin/ops: backfill historical reservation daily snapshots (exact pacing)
export const backfillSnapshots = (propertyId: string, options?: { limit?: number; dryRun?: boolean }) =>
  request<any>(`/admin/${propertyId}/backfill-snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      limit: options?.limit,
      dryRun: options?.dryRun || false,
    }),
  });

// Admin/ops: reconstruct a specific historical as-of snapshot date (marked as reconstructed source)
export const reconstructSnapshotAsOf = (
  propertyId: string,
  options: { snapshotDate: string; dryRun?: boolean }
) =>
  request<any>(`/admin/${propertyId}/reconstruct-snapshot-asof`, {
    method: 'POST',
    body: JSON.stringify({
      snapshotDate: options.snapshotDate,
      dryRun: options.dryRun || false,
    }),
  });

// =====================================================
// Costs V4 (uses types from @financial-os/shared)
// =====================================================

// Cost types for API responses
export interface CostCategory {
  id: string;
  name: string;
  monthlyAmount: number;
}

export interface ExtraordinaryCost {
  id: string;
  name: string;
  amount: number;
  date: string;
}

export interface VariableCostsInput {
  cleaningPerStay: number;
  laundryMonthly: number;
  amenitiesMonthly: number;
}

export interface FixedCostsInput {
  salaries: number;
  rent: number;
  utilities: number;
  other: number;
}

export interface ChannelCommissions {
  defaultRate: number;
  byChannel: Record<string, number>;
}

export interface PaymentFees {
  enabled: boolean;
  defaultRate: number;
  byMethod: Record<string, number>;
}

export interface CalculatedCosts {
  occupiedNightsLastMonth: number;
  totalReservationsLastMonth: number;
  avgNightsPerStay: number;
  variablePerNight: number;
  totalFixedMonthly: number;
  fixedPerDay: number;
}

export interface CostSettingsResponse {
  property_id: string;
  room_count?: number;
  starting_cash_balance: number;
  variable_categories?: CostCategory[];
  fixed_categories?: CostCategory[];
  extraordinary_costs?: ExtraordinaryCost[];
  variable_costs?: VariableCostsInput;
  fixed_costs?: FixedCostsInput;
  channel_commissions: ChannelCommissions;
  payment_fees: PaymentFees;
  tax_rules?: Array<{
    id: string;
    type: 'VAT' | 'OCCUPANCY' | 'CITY_TAX' | 'OTHER';
    appliesTo: 'room_rate' | 'total';
    method: 'percentage' | 'fixed_per_night' | 'fixed_per_stay';
    value: number;
    includedInRate: boolean;
  }>;
  calculated: CalculatedCosts;
  updated_at: string;
}

export const getCosts = (propertyId: string) =>
  request<CostSettingsResponse>(`/costs/${propertyId}`);

// Channel data from PMS
export interface PMSChannel {
  name: string;
  reservationCount: number;
  totalRevenue: number;
  category: string | null;
}

export const getChannelsFromPMS = (propertyId: string) =>
  request<PMSChannel[]>(`/costs/${propertyId}/channels`);

export const updateCosts = (propertyId: string, data: {
  roomCount?: number;
  startingCashBalance?: number;
  // New flexible categories
  variableCategories?: CostCategory[];
  fixedCategories?: CostCategory[];
  extraordinaryCosts?: ExtraordinaryCost[];
  tax_rules?: any[];
  // Legacy (backward compatibility)
  variableCosts?: Partial<VariableCostsInput>;
  fixedCosts?: Partial<FixedCostsInput>;
  channelCommissions?: Partial<ChannelCommissions>;
  paymentFees?: Partial<PaymentFees>;
}) =>
  request<CostSettingsResponse>(`/costs/${propertyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Helper to calculate totals from categories
export function calculateTotalFromCategories(categories: CostCategory[]): number {
  return categories.reduce((sum, cat) => sum + (cat.monthlyAmount || 0), 0);
}

// Helper to calculate total fixed costs
export function calculateTotalFixedCosts(costs: FixedCostsInput): number {
  return (costs.salaries || 0) + (costs.rent || 0) + (costs.utilities || 0) + (costs.other || 0);
}

// =====================================================
// Monthly Costs
// =====================================================

export interface MonthlyCostEntry {
  categoryKey: string;
  displayName: string;
  costType: 'fixed' | 'variable' | 'extraordinary';
  amount: number;
  source: string;
  note?: string;
}

export interface CostCategoryOption {
  categoryKey: string;
  displayName: string;
  costTypeDefault: string;
  sortOrder: number;
}

export interface MonthlyCostsResponse {
  month: string;
  entries: MonthlyCostEntry[];
  cashBalance: number | null;
  categories: CostCategoryOption[];
}

export const getMonthlyCosts = (propertyId: string, month: string) =>
  request<MonthlyCostsResponse & { entries: MonthlyCostEntry[]; categories: CostCategoryOption[] }>(`/costs/${propertyId}/monthly/${month}`);

export const updateMonthlyCosts = (propertyId: string, month: string, data: {
  entries: Array<{
    categoryKey: string;
    costType: string;
    amount: number;
    note?: string;
  }>;
  cashBalance?: number | null;
}) =>
  request<any>(`/costs/${propertyId}/monthly/${month}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const copyPreviousMonthCosts = (propertyId: string, month: string) =>
  request<any>(`/costs/${propertyId}/monthly/${month}/copy-previous`, { method: 'POST' });

export const getCostCategories = (propertyId: string) =>
  request<CostCategoryOption[]>(`/costs/${propertyId}/categories`);

export const getImportJobs = (propertyId: string, month?: string) => {
  const params = month ? new URLSearchParams({ month }) : new URLSearchParams();
  return request<any[]>(`/import/jobs/${propertyId}?${params}`);
};

// =====================================================
// Data Health (Section 5 PRD)
// =====================================================
export const getDataHealth = (propertyId: string) =>
  request<any>(`/data-health/${propertyId}`);

// =====================================================
// Telemetry (Section 12 PRD)
// =====================================================
export const trackEvent = (propertyId: string, eventType: string, eventData?: any) =>
  request<void>('/telemetry', {
    method: 'POST',
    body: JSON.stringify({ propertyId, eventType, eventData }),
  });
