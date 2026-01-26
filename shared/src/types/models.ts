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
  
  updatedAt: string;
}

// =====================================================
// Action Completions
// =====================================================

export interface ActionCompletion {
  id: string;
  propertyId: string;
  actionType: string;
  stepIndex: number;
  completedAt: string;
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

