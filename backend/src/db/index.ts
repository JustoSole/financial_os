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
  getReservationsByProperty: (propertyId: string) => Promise<any[]>;
  getAllReservations: (propertyId: string) => Promise<any[]>;
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
}

// Always use Supabase as the database provider
export const database: DatabaseOperations = supabaseDatabase as any;

export function initializeDatabase() {
  console.log('✓ Database initialized (Supabase)');
}

export default database;
