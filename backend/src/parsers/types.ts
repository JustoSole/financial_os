// =====================================================
// Parser Types - Matches Cloudbeds Export Columns
// =====================================================

import { ReportType } from '../types';
import type { DetectedCurrency } from './csv-parser';

export interface ValidationResult {
  isValid: boolean;
  reportType: ReportType | 'unknown';
  detectedColumns: string[];
  missingRequired: string[];
  warnings: string[];
  preview: Record<string, any>[];
  detectedCurrency?: DetectedCurrency;
}

/**
 * Parsed from: Expanded Transaction Report with Details
 */
export interface ParsedTransaction {
  txnAt: string; // Transaction Date Time - Property
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
  rowHash: string;
}

/**
 * Parsed from: Reservations with Financials
 */
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
