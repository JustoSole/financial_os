import { 
  ReportType, 
} from '../types';
import { supabaseDatabase, setAuthContext, clearAuthContext } from './supabase-adapter';

// Re-export auth context functions for use in routes
export { setAuthContext, clearAuthContext };

// =====================================================
// Database Interface
// =====================================================

export interface DataDateRange {
  reservations: { min: string | null; max: string | null };
  transactions: { min: string | null; max: string | null };
}

export interface DatabaseOperations {
  getProperty: () => Promise<any>;
  getPropertyByUser: (userId: string) => Promise<any>;
  getPropertyById: (id: string) => Promise<any>;
  insertProperty: (property: any) => Promise<any>;
  updateProperty: (id: string, updates: any) => Promise<any>;
  insertImportFile: (file: any) => Promise<any>;
  updateImportFile: (id: string, updates: any) => Promise<void>;
  getImportFilesByProperty: (propertyId: string, limit?: number) => Promise<any[]>;
  getImportFiles: (propertyId: string) => Promise<any[]>;
  hasReportType: (propertyId: string, reportType: ReportType) => Promise<boolean>;
  getLastImportByType: (propertyId: string, reportType: ReportType) => Promise<string | null>;
  insertTransactions: (transactions: any[]) => Promise<void>;
  clearTransactionsByFile: (fileId: string) => Promise<void>;
  getTransactionsByProperty: (propertyId: string, startDate?: string, endDate?: string) => Promise<any[]>;
  sumCredits: (propertyId: string, startDate: string, endDate: string) => Promise<number>;
  sumDebits: (propertyId: string, startDate: string, endDate: string) => Promise<number>;
  getDailyFlow: (propertyId: string, startDate: string, endDate: string) => Promise<any[]>;
  getAlerts: (propertyId: string, startDate: string, endDate: string) => Promise<any[]>;
  insertReservations: (reservations: any[]) => Promise<void>;
  clearReservationsByFile: (fileId: string) => Promise<void>;
  getReservationsByProperty: (propertyId: string, options?: { startDate?: string; endDate?: string }) => Promise<any[]>;
  getReservationsBySourceFile: (propertyId: string, sourceFileId: string) => Promise<any[]>;
  getAllReservations: (propertyId: string, options?: { startDate?: string; endDate?: string }) => Promise<any[]>;
  isReservationDailySnapshotsReady: () => Promise<boolean>;
  upsertReservationDailySnapshots: (rows: any[]) => Promise<void>;
  getReservationDailySnapshotMetrics: (
    propertyId: string,
    snapshotDate: string,
    startDate: string,
    endDate: string
  ) => Promise<{
    snapshotDate: string;
    occupiedNights: number;
    revenue: number;
    paidAmount: number;
    pendingAmount: number;
    snapshotSource: 'imported' | 'reconstructed';
  } | null>;
  getReservationDailySnapshotDates: (propertyId: string, limit?: number) => Promise<string[]>;
  getReservationsWithBalance: (propertyId: string, minBalance?: number) => Promise<any[]>;
  getTotalBalanceDue: (propertyId: string) => Promise<number>;
  getDepositGaps: (propertyId: string) => Promise<any[]>;
  getChannelSummary: (propertyId: string, startDate: string, endDate: string) => Promise<any[]>;
  getCostSettings: (propertyId: string) => Promise<any>;
  upsertCostSettings: (propertyId: string, settings: any) => Promise<any>;
  getOccupancyStats: (propertyId: string, days?: number) => Promise<any>;
  getTotalMonthlyFixedCosts: (propertyId: string) => Promise<number>;
  getTotalMonthlyVariableCosts: (propertyId: string) => Promise<number>;
  getChannelsFromPMS: (propertyId: string) => Promise<any[]>;
  insertActionCompletion: (completion: any) => Promise<void>;
  getCompletedSteps: (propertyId: string, daysBack?: number) => Promise<any[]>;
  insertLog: (log: any) => Promise<void>;
  getLastImport: (propertyId: string) => Promise<string | null>;
  getDataHealth: (propertyId: string) => Promise<any>;
  getDataDateRange: (propertyId: string) => Promise<DataDateRange>;
  resetDatabase: (propertyId: string) => Promise<void>;

  // Monthly close operations
  countReservationsForMonth: (propertyId: string, monthStart: string, monthEnd: string) => Promise<number>;
  getOrCreateMonthlyPeriod: (propertyId: string, month: string) => Promise<any>;
  listMonthlyPeriods: (propertyId: string, limit?: number) => Promise<any[]>;
  updateMonthlyPeriod: (propertyId: string, month: string, updates: any) => Promise<any>;
  getMonthlyCosts: (propertyId: string, month: string) => Promise<any[]>;
  upsertMonthlyCosts: (propertyId: string, month: string, entries: any[]) => Promise<any>;
  getMonthlyCashBalance: (propertyId: string, month: string) => Promise<any>;
  upsertMonthlyCashBalance: (propertyId: string, month: string, balance: number) => Promise<any>;
  getCostCategories: () => Promise<any[]>;
  insertImportJob: (job: any) => Promise<any>;
  updateImportJob: (id: string, updates: any) => Promise<void>;
  listImportJobs: (propertyId: string, options?: { month?: string; limit?: number }) => Promise<any[]>;
  findImportJobByHash: (propertyId: string, jobType: string, fileHash: string) => Promise<any>;
}

// Always use Supabase as the database provider
export const database: DatabaseOperations = supabaseDatabase as any;

export function initializeDatabase() {
  console.log('✓ Database initialized (Supabase)');
}

export default database;
