// =====================================================
// API Client - Simple fetch wrapper for Financial OS MVS
// =====================================================
import { supabase } from './lib/supabase';

const API_BASE = (import.meta as any).env.VITE_API_URL || '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    // Obtener el token de sesión de Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    const json = await response.json();
    return json;
  } catch (error: any) {
    return { success: false, error: error.message || 'Error de conexión' };
  }
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

// Get all completed steps (for frontend-generated actions)
export const getCompletedSteps = (propertyId: string, daysBack: number = 90) =>
  request<{ byActionType: Record<string, number[]>; byActionId: Record<string, string[]> }>(
    `/actions/${propertyId}/completed?daysBack=${daysBack}`
  );

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
