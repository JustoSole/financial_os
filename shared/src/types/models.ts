/**
 * =====================================================
 * Financial OS - Data Models
 * Entities stored in the database
 * =====================================================
 */

import type { 
  ReportType, 
  ImportStatus, 
  PlanType,
  ChannelCategory,
  ConfidenceBand,
  CostEntryType,
  CostEntrySource,
  ImportJobType,
  ImportJobStatus,
} from './enums';

// =====================================================
// Property
// =====================================================

export interface Property {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  createdAt: string;
  plan: PlanType;
}

// =====================================================
// Import Files
// =====================================================

export interface ImportFile {
  id: string;
  propertyId: string;
  reportType: ReportType;
  filename: string;
  uploadedAt: string;
  rows: number;
  warningsCount: number;
  status: ImportStatus;
  parserVersion: string;
}

// =====================================================
// Ledger Transactions (from Expanded Transaction Report)
// =====================================================

export interface LedgerTransaction {
  id: string;
  propertyId: string;
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
  sourceFileId: string;
  createdAt: string;
}

// =====================================================
// Reservation Financials (from Reservations with Financials)
// =====================================================

export interface ReservationFinancial {
  id: string;
  propertyId: string;
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
  sourceFileId: string;
  createdAt: string;
}

// =====================================================
// Cost Settings (V4 - Flexible Categories)
// =====================================================

/** Flexible cost category (user-customizable) */
export interface CostCategory {
  id: string;
  name: string;
  monthlyAmount: number;
}

/** One-time/extraordinary costs */
export interface ExtraordinaryCost {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM format
}

/** Variable costs input (legacy V3 compatibility) */
export interface VariableCostsInput {
  cleaningPerStay: number;
  laundryMonthly: number;
  amenitiesMonthly: number;
}

/** Fixed costs input (legacy V3 compatibility) */
export interface FixedCostsInput {
  salaries: number;
  rent: number;
  utilities: number;
  other: number;
}

/** Channel commission configuration */
export interface ChannelCommissions {
  defaultRate: number;
  byChannel: Record<string, number>;
}

/** Payment gateway fees configuration */
export interface PaymentFees {
  enabled: boolean;
  defaultRate: number;
  byMethod: Record<string, number>;
}

/** Tax rule configuration */
export interface TaxRule {
  id: string;
  name: string;
  type: 'VAT' | 'OCCUPANCY' | 'CITY_TAX' | 'OTHER';
  appliesTo: 'room_rate' | 'total';
  method: 'percentage' | 'fixed_per_night' | 'fixed_per_stay';
  value: number;
  includedInRate: boolean;
}

/** Full cost settings (V4 with backward compatibility) */
export interface CostSettings {
  propertyId: string;
  roomCount: number;
  startingCashBalance: number;
  
  // V4 flexible categories
  variableCategories: CostCategory[];
  fixedCategories: CostCategory[];
  extraordinaryCosts: ExtraordinaryCost[];
  
  // Legacy V3 fields (backward compatibility)
  variableCosts: VariableCostsInput;
  fixedCosts: FixedCostsInput;
  
  // Commissions & fees
  channelCommissions: ChannelCommissions;
  paymentFees: PaymentFees;

  // Tax rules
  taxRules: TaxRule[];
  
  updatedAt: string;
}

// =====================================================
// Action Completions
// =====================================================

export interface ActionCompletion {
  id: string;
  propertyId: string;
  /** Legacy: action type (e.g. profitability, ota_dependency) */
  actionType?: string;
  /** Legacy: step index (number) */
  stepIndex?: number;
  /** New format: stable action identifier (e.g. collect-RES123) */
  actionId?: string;
  /** New format: step identifier (e.g. collect-RES123-verify) or 'done' | 'dismissed' */
  stepId?: string;
  completedAt: string;
}

// =====================================================
// Helpers
// =====================================================

export function getConfidenceBand(score: number): ConfidenceBand {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

// =====================================================
// Monthly Cost Entry
// =====================================================

export interface MonthlyCostEntry {
  id: string;
  propertyId: string;
  month: string;
  categoryKey: string;
  costType: CostEntryType;
  amount: number;
  source: CostEntrySource;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// Monthly Cash Balance
// =====================================================

export interface MonthlyCashBalance {
  id: string;
  propertyId: string;
  month: string;
  balance: number;
  asOfDate: string;
  source: string;
  createdAt: string;
}

// =====================================================
// Import Job
// =====================================================

export interface ImportJob {
  id: string;
  propertyId: string;
  jobType: ImportJobType;
  sourceSystem: string;
  status: ImportJobStatus;
  targetMonth: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  monthsCovered: string[] | null;
  fileName: string;
  fileHash: string;
  rowsTotal: number;
  rowsOk: number;
  rowsError: number;
  errorLog: any[];
  importFileId: string | null;
  createdAt: string;
}

// =====================================================
// Cost Category (catalog)
// =====================================================

export interface CostCategoryCatalog {
  categoryKey: string;
  displayName: string;
  costTypeDefault: CostEntryType;
  sortOrder: number;
  active: boolean;
  isSystem: boolean;
}

// =====================================================
// Calculated Costs (derived from PMS data + settings)
// =====================================================

export interface CalculatedCosts {
  occupiedNightsLastMonth: number;
  totalReservationsLastMonth: number;
  avgNightsPerStay: number;
  variablePerNight: number;
  cleaningPerStay: number;
  totalFixedMonthly: number;
  fixedPerDay: number;
  exampleStay?: {
    nights: number;
    variableCost: number;
    cleaningCost: number;
    fixedAllocated: number;
    totalCost: number;
  };
}

