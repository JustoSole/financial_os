/**
 * =====================================================
 * Financial OS - API Types
 * Request/Response types for endpoints
 * =====================================================
 */

import type { ReportType, ActionType, ConfidenceLevel, CostEntryType } from './enums';

// =====================================================
// Generic API Response
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =====================================================
// Import Types
// =====================================================

export interface ImportResult {
  success: boolean;
  fileId: string;
  reportType: ReportType | 'unknown';
  rowsProcessed: number;
  rowsSkipped: number;
  warnings: string[];
  errors: string[];
}

export interface ValidationResult {
  isValid: boolean;
  reportType: ReportType | 'unknown';
  detectedColumns: string[];
  missingRequired: string[];
  warnings: string[];
  preview: Record<string, unknown>[];
  detectedCurrency?: {
    code: string;
    symbol: string;
    confidence: number;
  };
}

// =====================================================
// Action Types
// =====================================================

export type ActionCategory = 'collections' | 'channels' | 'pricing' | 'cash' | 'data';
export type ActionSeverity = 'critical' | 'warning' | 'positive' | 'info';
export type ActionStatus = 'pending' | 'done' | 'dismissed';

export interface ActionStep {
  id?: string;
  text: string;
  completed: boolean;
}

export interface ActionEvidence {
  metric: string;
  value: string;
}

export interface RecommendedAction {
  id: string;
  type: ActionType | string;
  title: string;
  description: string;
  category: ActionCategory;
  severity: ActionSeverity;
  status?: ActionStatus;
  completedAt?: string;
  impact: {
    value: number;
    unit: string;
    direction: 'up' | 'down';
  };
  confidence?: ConfidenceLevel;
  steps: ActionStep[];
  evidence: ActionEvidence[];
  priority: number;
  isActive?: boolean;
  triggeredAt?: string;
  href?: string;
}

// =====================================================
// Cost Settings API Types
// =====================================================

export interface CostSettingsUpdateRequest {
  roomCount?: number;
  startingCashBalance?: number;
  variableCategories?: Array<{
    id: string;
    name: string;
    monthlyAmount: number;
  }>;
  fixedCategories?: Array<{
    id: string;
    name: string;
    monthlyAmount: number;
  }>;
  extraordinaryCosts?: Array<{
    id: string;
    name: string;
    amount: number;
    date: string;
  }>;
  variableCosts?: {
    cleaningPerStay?: number;
    laundryMonthly?: number;
    amenitiesMonthly?: number;
  };
  fixedCosts?: {
    salaries?: number;
    rent?: number;
    utilities?: number;
    other?: number;
  };
  channelCommissions?: {
    defaultRate?: number;
    byChannel?: Record<string, number>;
  };
  paymentFees?: {
    enabled?: boolean;
    defaultRate?: number;
    byMethod?: Record<string, number>;
  };
}

export interface PMSChannel {
  name: string;
  reservationCount: number;
  totalRevenue: number;
  category: string | null;
}

// =====================================================
// Monthly Costs API Types
// =====================================================

export interface MonthlyCostEntrySummary {
  categoryKey: string;
  displayName: string;
  costType: CostEntryType;
  amount: number;
  source: string;
}

export interface MonthlyCostUpsertRequest {
  entries: Array<{
    categoryKey: string;
    costType: CostEntryType;
    amount: number;
    note?: string;
  }>;
  cashBalance?: number;
}

// =====================================================
// Telemetry Types
// =====================================================

export interface TelemetryEvent {
  propertyId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  timestamp?: string;
}

// =====================================================
// Parser Types (for CSV import)
// =====================================================

export interface ParsedTransaction {
  txnAt: string;
  reservationNumber: string | null;
  reservationSource: string | null;
  txnType: string | null;
  debits: number;
  credits: number;
  voidFlag: boolean;
  refundFlag: boolean;
  adjustmentFlag: boolean;
  description: string | null;
  notes: string | null;
  txnSource: string | null;
}

export interface ParsedReservation {
  reservationNumber: string;
  guestName: string | null;
  status: string;
  sourceCategory: string | null;
  source: string | null;
  checkIn: string;
  checkOut: string;
  roomNights: number;
  roomRevenueTotal: number;
  taxesTotal: number;
  paidAmount: number;
  balanceDue: number;
  suggestedDeposit: number;
  hotelCollectFlag: boolean;
}

export interface ParsedChannel {
  sourceCategory: string | null;
  source: string;
  roomNights: number;
  roomRevenueTotal: number;
  estimatedCommission: number;
}

