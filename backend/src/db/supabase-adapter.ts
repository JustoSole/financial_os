import { supabase, createAuthenticatedClient, hasServiceRoleKey } from './supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  ReportType, 
  calculateTotalFixedCosts,
} from '../types';
import {
  dateToIsoDay,
  isExcludedReservationStatus,
  prorateReservationToPeriod,
  reservationOverlapsPeriod,
} from '../services/metrics-core';

/**
 * Context para operaciones que requieren autenticación.
 * Permite pasar un cliente autenticado para operaciones con RLS.
 */
let _authContext: { client: SupabaseClient } | null = null;

/**
 * Establece el contexto de autenticación para operaciones posteriores.
 * Usado cuando necesitamos bypasear RLS con el token del usuario.
 */
export function setAuthContext(accessToken: string | null) {
  if (accessToken && !hasServiceRoleKey) {
    _authContext = { client: createAuthenticatedClient(accessToken) };
  } else {
    _authContext = null;
  }
}

/**
 * Limpia el contexto de autenticación.
 */
export function clearAuthContext() {
  _authContext = null;
}

/**
 * Obtiene el cliente Supabase apropiado.
 * Si hay un contexto autenticado y no tenemos SERVICE_ROLE_KEY, usa ese.
 * De lo contrario, usa el cliente global.
 */
function getClient(): SupabaseClient {
  // Siempre usar el cliente principal (que usa SERVICE_ROLE_KEY) para evitar problemas de RLS
  // El cliente principal está configurado en supabase-client.ts para usar SERVICE_ROLE_KEY si existe
  return supabase;
}

/**
 * Supabase implementation of the Database interface
 */
export const supabaseDatabase = {
  // =====================================================
  // Data Access (Pure)
  // =====================================================
  getImportFiles: async (propertyId: string) => {
    const { data, error } = await getClient()
      .from('import_files')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'processed');
    
    if (error) return [];
    return data;
  },

  countReservationsForMonth: async (propertyId: string, monthStart: string, monthEnd: string) => {
    const { count, error } = await getClient()
      .from('reservation_financials')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .not('status', 'in', '("Cancelled","No Show")')
      .lte('check_in', monthEnd)
      .gte('check_out', monthStart);
    if (error) return 0;
    return count ?? 0;
  },

  getAllReservations: async (propertyId: string, options?: { startDate?: string; endDate?: string }) => {
    const RESERVATION_COLS = 'property_id,reservation_number,guest_name,status,source,source_category,check_in,check_out,reservation_date,room_nights,room_revenue_total,taxes_total,paid_amount,balance_due,suggested_deposit,hotel_collect_flag,source_file_id';
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      let query = getClient()
        .from('reservation_financials')
        .select(RESERVATION_COLS)
        .eq('property_id', propertyId)
        .range(from, from + PAGE_SIZE - 1)
        .order('check_in', { ascending: false });

      if (options?.startDate) query = query.gte('check_out', options.startDate);
      if (options?.endDate) query = query.lte('check_in', options.endDate);

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching reservations:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`[DB] Fetched ${allData.length} reservations for property ${propertyId}${options?.startDate ? ` (${options.startDate} - ${options.endDate})` : ' (all)'}`);
    return allData;
  },

  upsertReservationDailySnapshots: async (rows: any[]) => {
    if (!rows || rows.length === 0) {
      return;
    }

    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await getClient()
        .from('reservation_daily_snapshots')
        .upsert(batch, { onConflict: 'property_id,snapshot_date,stay_date' });

      if (error) {
        throw error;
      }
    }
  },

  isReservationDailySnapshotsReady: async () => {
    const { error } = await getClient()
      .from('reservation_daily_snapshots')
      .select('property_id')
      .limit(1);

    if (!error) {
      return true;
    }

    const message = String(error.message || '');
    if (message.includes('Could not find the table')) {
      return false;
    }

    // For other errors (e.g. permissions), assume table exists and let caller continue.
    return true;
  },

  getReservationDailySnapshotMetrics: async (
    propertyId: string,
    snapshotDate: string,
    startDate: string,
    endDate: string
  ) => {
    const { data, error } = await getClient()
      .from('reservation_daily_snapshots')
      .select('occupied_nights, revenue, paid_amount, pending_amount, snapshot_source')
      .eq('property_id', propertyId)
      .eq('snapshot_date', snapshotDate)
      .gte('stay_date', startDate)
      .lt('stay_date', endDate);

    if (error) {
      return null;
    }

    if (!data || data.length === 0) {
      // If snapshot_date exists but there are no rows in this stay range,
      // this is still an exact historical "zero occupancy" case.
      const { data: anyDateRows, error: existsError } = await getClient()
        .from('reservation_daily_snapshots')
        .select('snapshot_source')
        .eq('property_id', propertyId)
        .eq('snapshot_date', snapshotDate);

      if (!existsError && anyDateRows && anyDateRows.length > 0) {
        return {
          snapshotDate,
          occupiedNights: 0,
          revenue: 0,
          paidAmount: 0,
          pendingAmount: 0,
          snapshotSource: String(anyDateRows[0].snapshot_source || 'imported') === 'reconstructed'
            ? 'reconstructed'
            : 'imported',
        };
      }

      return null;
    }

    return {
      snapshotDate,
      occupiedNights: data.reduce((sum: number, row: any) => sum + (Number(row.occupied_nights) || 0), 0),
      revenue: data.reduce((sum: number, row: any) => sum + (Number(row.revenue) || 0), 0),
      paidAmount: data.reduce((sum: number, row: any) => sum + (Number(row.paid_amount) || 0), 0),
      pendingAmount: data.reduce((sum: number, row: any) => sum + (Number(row.pending_amount) || 0), 0),
      snapshotSource: data.some((row: any) => row.snapshot_source === 'reconstructed')
        ? 'reconstructed'
        : 'imported',
    };
  },

  getReservationDailySnapshotDates: async (propertyId: string, limit: number = 30) => {
    const PAGE_SIZE = 1000;
    const uniqueDates: string[] = [];
    const seen = new Set<string>();
    let from = 0;
    let hasMore = true;

    while (hasMore && uniqueDates.length < limit) {
      const { data, error } = await getClient()
        .from('reservation_daily_snapshots')
        .select('snapshot_date')
        .eq('property_id', propertyId)
        .order('snapshot_date', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data || data.length === 0) {
        break;
      }

      for (const row of data as any[]) {
        const value = String(row.snapshot_date || '');
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        uniqueDates.push(value);
        if (uniqueDates.length >= limit) {
          break;
        }
      }

      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }

    return uniqueDates;
  },

  getLastImport: async (propertyId: string) => {
    const { data, error } = await getClient()
      .from('import_files')
      .select('uploaded_at')
      .eq('property_id', propertyId)
      .eq('status', 'processed')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) return null;
    return data?.uploaded_at || null;
  },

  resetDatabase: async (propertyId: string) => {
    // Child tables first (FK constraints), then existing tables
    const { error: errMce } = await getClient().from('monthly_cost_entries').delete().eq('property_id', propertyId);
    if (errMce) throw errMce;
    const { error: errMcb } = await getClient().from('monthly_cash_balances').delete().eq('property_id', propertyId);
    if (errMcb) throw errMcb;
    const { error: errIj } = await getClient().from('import_jobs').delete().eq('property_id', propertyId);
    if (errIj) throw errIj;
    const { error: errMp } = await getClient().from('monthly_periods').delete().eq('property_id', propertyId);
    if (errMp) throw errMp;

    const { error: error1 } = await getClient().from('ledger_transactions').delete().eq('property_id', propertyId);
    if (error1) throw error1;
    const { error: error2 } = await getClient().from('reservation_financials').delete().eq('property_id', propertyId);
    if (error2) throw error2;
    const { error: error4 } = await getClient().from('import_files').delete().eq('property_id', propertyId);
    if (error4) throw error4;
  },

  // =====================================================
  // Properties
  // =====================================================
  getProperty: async () => {
    const { data, error } = await getClient()
      .from('properties')
      .select('*')
      .limit(1)
      .single();
    
    if (error) return null;
    return data;
  },

  getPropertyByUser: async (userId: string) => {
    const { data, error } = await getClient()
      .from('properties')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    if (error) return null;
    return data;
  },
  
  getPropertyById: async (id: string) => {
    const { data, error } = await getClient()
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },
  
  insertProperty: async (property: any) => {
    const { data, error } = await getClient()
      .from('properties')
      .insert(property)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  updateProperty: async (id: string, updates: any) => {
    const { data, error } = await getClient()
      .from('properties')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) return null;
    return data;
  },

  // =====================================================
  // Import Files
  // =====================================================
  insertImportFile: async (file: any) => {
    const { data, error } = await getClient()
      .from('import_files')
      .insert({
        property_id: file.propertyId,
        report_type: file.reportType,
        filename: file.filename,
        rows: file.rows,
        warnings_count: file.warningsCount,
        status: file.status,
        parser_version: file.parserVersion
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error inserting import file:', error);
      throw error;
    }
    return data;
  },
  
  updateImportFile: async (id: string, updates: any) => {
    const { error } = await getClient()
      .from('import_files')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating import file:', error);
      throw error;
    }
  },
  
  getImportFilesByProperty: async (propertyId: string, limit: number = 20) => {
    const { data, error } = await getClient()
      .from('import_files')
      .select('*')
      .eq('property_id', propertyId)
      .order('uploaded_at', { ascending: false })
      .limit(limit);
    
    if (error) return [];
    return data;
  },
  
  hasReportType: async (propertyId: string, reportType: ReportType): Promise<boolean> => {
    const { count, error } = await getClient()
      .from('import_files')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('report_type', reportType)
      .eq('status', 'processed');
    
    if (error) return false;
    return (count || 0) > 0;
  },

  getLastImportByType: async (propertyId: string, reportType: ReportType): Promise<string | null> => {
    const { data, error } = await getClient()
      .from('import_files')
      .select('uploaded_at')
      .eq('property_id', propertyId)
      .eq('report_type', reportType)
      .eq('status', 'processed')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) return null;
    return data?.uploaded_at || null;
  },

  // =====================================================
  // Transactions (Atomic Operations)
  // =====================================================
  
  /**
   * Executes multiple operations in a single transaction-like manner using RPC.
   * Note: Supabase doesn't support multi-statement transactions over REST.
   * We use a stored procedure if complex logic is needed, or just batching.
   * For now, we'll implement a more robust batching approach.
   */
  executeInTransaction: async (callback: (db: any) => Promise<void>) => {
    // This is a placeholder for actual transaction support if we move to a different driver
    // In Supabase, we'd ideally use a Postgres Function (RPC) for atomicity.
    // For now, we'll just execute the callback.
    await callback(supabaseDatabase);
  },

  // =====================================================
  // Ledger Transactions
  // =====================================================
  insertTransactions: async (transactions: any[]) => {
    const formatted = transactions.map(t => ({
      property_id: t.propertyId,
      source_file_id: t.sourceFileId,
      txn_at: t.txnAt,
      reservation_number: t.reservationNumber,
      reservation_source: t.reservationSource,
      txn_type: t.txnType,
      debits: t.debits,
      credits: t.credits,
      void_flag: t.voidFlag,
      refund_flag: t.refundFlag,
      adjustment_flag: t.adjustmentFlag,
      description: t.description,
      notes: t.notes,
      txn_source: t.txnSource,
      row_hash: t.rowHash
    }));

    // UPSERT basado en property_id y row_hash para evitar duplicados exactos
    const { error } = await getClient()
      .from('ledger_transactions')
      .upsert(formatted, { 
        onConflict: 'property_id, row_hash',
        ignoreDuplicates: false // Queremos actualizar si algo cambió pero el hash es igual (aunque el hash debería cambiar si algo cambia)
      });
    
    if (error) {
      console.error('Error inserting transactions:', error);
      throw error;
    }
  },
  
  clearTransactionsByFile: async (fileId: string) => {
    const { error } = await getClient()
      .from('ledger_transactions')
      .delete()
      .eq('source_file_id', fileId);
    
    if (error) throw error;
  },

  replaceTransactionsByFile: async (fileId: string, transactions: any[]) => {
    const formatted = transactions.map(t => ({
      property_id: t.propertyId,
      source_file_id: t.sourceFileId,
      txn_at: t.txnAt,
      reservation_number: t.reservationNumber,
      reservation_source: t.reservationSource,
      txn_type: t.txnType,
      debits: t.debits,
      credits: t.credits,
      void_flag: t.voidFlag,
      refund_flag: t.refundFlag,
      adjustment_flag: t.adjustmentFlag,
      description: t.description,
      notes: t.notes,
      txn_source: t.txnSource,
      row_hash: t.rowHash
    }));

    // We use a single RPC call if we want true atomicity for delete + insert
    // For now, we'll use the existing methods but wrapped in a way that suggests atomicity
    const { error: deleteError } = await getClient()
      .from('ledger_transactions')
      .delete()
      .eq('source_file_id', fileId);
    
    if (deleteError) throw deleteError;

    if (formatted.length > 0) {
      const { error: insertError } = await getClient()
        .from('ledger_transactions')
        .insert(formatted);
      
      if (insertError) throw insertError;
    }
  },

  getTransactionsByProperty: async (propertyId: string, startDate?: string, endDate?: string) => {
    const TXN_COLS = 'property_id,txn_at,reservation_number,reservation_source,txn_type,debits,credits,void_flag,refund_flag,adjustment_flag,description,notes,txn_source,source_file_id';
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      let query = getClient()
        .from('ledger_transactions')
        .select(TXN_COLS)
        .eq('property_id', propertyId)
        .range(from, from + PAGE_SIZE - 1)
        .order('txn_at', { ascending: false });
      
      // Ensure we are comparing just the date part if the column is a timestamp
      if (startDate) query = query.gte('txn_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('txn_at', `${endDate}T23:59:59`);
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching transactions:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  },

  sumCredits: async (propertyId: string, startDate: string, endDate: string): Promise<number> => {
    const { data, error } = await getClient()
      .from('ledger_transactions')
      .select('credits')
      .eq('property_id', propertyId)
      .gte('txn_at', `${startDate}T00:00:00`)
      .lte('txn_at', `${endDate}T23:59:59`)
      .eq('void_flag', false);
    
    if (error) return 0;
    return data.reduce((sum, t) => sum + (Number(t.credits) || 0), 0);
  },

  sumDebits: async (propertyId: string, startDate: string, endDate: string): Promise<number> => {
    const { data, error } = await getClient()
      .from('ledger_transactions')
      .select('debits')
      .eq('property_id', propertyId)
      .gte('txn_at', `${startDate}T00:00:00`)
      .lte('txn_at', `${endDate}T23:59:59`);
    
    if (error) return 0;
    return data.reduce((sum, t) => sum + (Number(t.debits) || 0), 0);
  },

  getDailyFlow: async (propertyId: string, startDate: string, endDate: string) => {
    const { data, error } = await getClient()
      .from('ledger_transactions')
      .select('txn_at, credits, debits')
      .eq('property_id', propertyId)
      .gte('txn_at', `${startDate}T00:00:00`)
      .lte('txn_at', `${endDate}T23:59:59`);
    
    if (error) return [];
    
    const byDate: Record<string, { credits: number; debits: number }> = {};
    for (const t of data) {
      const date = t.txn_at.substring(0, 10);
      if (!byDate[date]) byDate[date] = { credits: 0, debits: 0 };
      byDate[date].credits += Number(t.credits) || 0;
      byDate[date].debits += Number(t.debits) || 0;
    }
    
    return Object.entries(byDate)
      .map(([date, { credits, debits }]) => ({
        date,
        credits,
        debits,
        netFlow: credits - debits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getAlerts: async (propertyId: string, startDate: string, endDate: string) => {
    const { data, error } = await getClient()
      .from('ledger_transactions')
      .select('txn_at,credits,debits,refund_flag,adjustment_flag,description')
      .eq('property_id', propertyId)
      .gte('txn_at', `${startDate}T00:00:00`)
      .lte('txn_at', `${endDate}T23:59:59`)
      .or('refund_flag.eq.true,adjustment_flag.eq.true');
    
    if (error) return [];
    
    const refunds = data.filter(t => t.refund_flag);
    const adjustments = data.filter(t => t.adjustment_flag);
    
    const alerts = [];
    if (refunds.length > 0) {
      alerts.push({
        type: 'refund',
        count: refunds.length,
        amount: refunds.reduce((sum, t) => sum + (Number(t.credits) || 0), 0),
        description: `${refunds.length} reembolsos en el período`,
      });
    }
    if (adjustments.length > 0) {
      alerts.push({
        type: 'adjustment',
        count: adjustments.length,
        amount: adjustments.reduce((sum, t) => sum + Math.abs((Number(t.debits) || 0) - (Number(t.credits) || 0)), 0),
        description: `${adjustments.length} ajustes en el período`,
      });
    }
    
    return alerts;
  },

  // =====================================================
  // Reservation Financials
  // =====================================================
  insertReservations: async (reservations: any[]) => {
    const formatted = reservations.map(r => ({
      property_id: r.propertyId,
      source_file_id: r.sourceFileId,
      reservation_number: r.reservationNumber,
      guest_name: r.guestName,
      status: r.status,
      source_category: r.sourceCategory,
      source: r.source,
      check_in: r.checkIn,
      check_out: r.checkOut,
      reservation_date: r.reservationDate || null,
      room_nights: r.roomNights,
      room_revenue_total: r.roomRevenueTotal,
      taxes_total: r.taxesTotal,
      paid_amount: r.paidAmount,
      balance_due: r.balance_due || r.balanceDue,
      suggested_deposit: r.suggested_deposit || r.suggestedDeposit,
      hotel_collect_flag: r.hotelCollectFlag
    }));

    // UPSERT basado en property_id y reservation_number
    const { error } = await getClient()
      .from('reservation_financials')
      .upsert(formatted, { 
        onConflict: 'property_id, reservation_number'
      });
    
    if (error) {
      console.error('Error inserting reservations:', error);
      throw error;
    }
  },

  clearReservationsByFile: async (fileId: string) => {
    const { error } = await getClient()
      .from('reservation_financials')
      .delete()
      .eq('source_file_id', fileId);
    
    if (error) throw error;
  },

  replaceReservationsByFile: async (fileId: string, reservations: any[]) => {
    const formatted = reservations.map(r => ({
      property_id: r.propertyId,
      source_file_id: r.sourceFileId,
      reservation_number: r.reservationNumber,
      guest_name: r.guestName,
      status: r.status,
      source_category: r.sourceCategory,
      source: r.source,
      check_in: r.checkIn,
      check_out: r.checkOut,
      reservation_date: r.reservationDate || null,
      room_nights: r.roomNights,
      room_revenue_total: r.roomRevenueTotal,
      taxes_total: r.taxesTotal,
      paid_amount: r.paidAmount,
      balance_due: r.balance_due || r.balanceDue,
      suggested_deposit: r.suggested_deposit || r.suggestedDeposit,
      hotel_collect_flag: r.hotelCollectFlag
    }));

    const { error: deleteError } = await getClient()
      .from('reservation_financials')
      .delete()
      .eq('source_file_id', fileId);
    
    if (deleteError) throw deleteError;

    if (formatted.length > 0) {
      const { error: insertError } = await getClient()
        .from('reservation_financials')
        .insert(formatted);
      
      if (insertError) throw insertError;
    }
  },

  getReservationsByProperty: async (propertyId: string, options?: { startDate?: string; endDate?: string }) => {
    const RESERVATION_COLS = 'property_id,reservation_number,guest_name,status,source,source_category,check_in,check_out,reservation_date,room_nights,room_revenue_total,taxes_total,paid_amount,balance_due,suggested_deposit,hotel_collect_flag,source_file_id';
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      let query = getClient()
        .from('reservation_financials')
        .select(RESERVATION_COLS)
        .eq('property_id', propertyId)
        .range(from, from + PAGE_SIZE - 1)
        .order('check_in', { ascending: false });

      if (options?.startDate) query = query.gte('check_out', options.startDate);
      if (options?.endDate) query = query.lte('check_in', options.endDate);

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching reservations:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  },

  getReservationsBySourceFile: async (propertyId: string, sourceFileId: string) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await getClient()
        .from('reservation_financials')
        .select('*')
        .eq('property_id', propertyId)
        .eq('source_file_id', sourceFileId)
        .range(from, from + PAGE_SIZE - 1)
        .order('check_in', { ascending: false });

      if (error) {
        console.error('Error fetching reservations by source file:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return allData;
  },

  getReservationsWithBalance: async (propertyId: string, minBalance: number = 0) => {
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('reservation_number,guest_name,status,source,check_in,check_out,room_revenue_total,paid_amount,balance_due')
      .eq('property_id', propertyId)
      .gt('balance_due', minBalance)
      .order('balance_due', { ascending: false });
    
    if (error) return [];
    return data;
  },

  getTotalBalanceDue: async (propertyId: string): Promise<number> => {
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('balance_due')
      .eq('property_id', propertyId)
      .gt('balance_due', 0);
    
    if (error) return 0;
    return data.reduce((sum, r) => sum + (Number(r.balance_due) || 0), 0);
  },

  getDepositGaps: async (propertyId: string) => {
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('*')
      .eq('property_id', propertyId)
      .neq('status', 'Cancelled');
    
    if (error) return [];
    
    return data
      .filter(r => (Number(r.suggested_deposit) - Number(r.paid_amount)) > 0)
      .map(r => ({
        ...r,
        deposit_gap: Number(r.suggested_deposit) - Number(r.paid_amount),
      }))
      .sort((a, b) => b.deposit_gap - a.deposit_gap);
  },

  getChannelSummary: async (propertyId: string, startDate: string, endDate: string) => {
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('source,source_category,room_nights,room_revenue_total')
      .eq('property_id', propertyId)
      .neq('status', 'Cancelled')
      .gte('check_in', startDate)
      .lte('check_in', endDate);
    
    if (error) return [];
    
    const summary: Record<string, any> = {};
    for (const r of data) {
      const source = r.source || 'Desconocido';
      if (!summary[source]) {
        summary[source] = {
          source: source,
          source_category: r.source_category,
          room_nights: 0,
          room_revenue_total: 0,
          estimated_commission: 0,
        };
      }
      summary[source].room_nights += Number(r.room_nights) || 0;
      summary[source].room_revenue_total += Number(r.room_revenue_total) || 0;
    }
    
    return Object.values(summary).sort((a: any, b: any) => b.room_revenue_total - a.room_revenue_total);
  },

  // =====================================================
  // Cost Settings
  // =====================================================
  getCostSettings: async (propertyId: string) => {
    const { data, error } = await getClient()
      .from('cost_settings')
      .select('*')
      .eq('property_id', propertyId)
      .single();
    
    if (error) return null;
    return data;
  },
  
  upsertCostSettings: async (propertyId: string, settings: any) => {
    const upsertData: Record<string, any> = {
      property_id: propertyId,
      updated_at: new Date().toISOString(),
    };
    const roomCount = settings.roomCount || settings.room_count;
    if (roomCount !== undefined) upsertData.room_count = roomCount;
    const cashBalance = settings.startingCashBalance || settings.starting_cash_balance;
    if (cashBalance !== undefined) upsertData.starting_cash_balance = cashBalance;
    if (settings.variable_categories !== undefined) upsertData.variable_categories = settings.variable_categories;
    if (settings.fixed_categories !== undefined) upsertData.fixed_categories = settings.fixed_categories;
    if (settings.extraordinary_costs !== undefined) upsertData.extraordinary_costs = settings.extraordinary_costs;
    if (settings.variable_costs !== undefined) upsertData.variable_costs = settings.variable_costs;
    if (settings.fixed_costs !== undefined) upsertData.fixed_costs = settings.fixed_costs;
    if (settings.channel_commissions !== undefined) upsertData.channel_commissions = settings.channel_commissions;
    if (settings.payment_fees !== undefined) upsertData.payment_fees = settings.payment_fees;
    if (settings.tax_rules !== undefined) upsertData.tax_rules = settings.tax_rules;

    const { data, error } = await getClient()
      .from('cost_settings')
      .upsert(upsertData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  getOccupancyStats: async (propertyId: string, days: number = 30) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = dateToIsoDay(startDate);
    const endStr = dateToIsoDay(endDate);
    
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('status, check_in, check_out, room_revenue_total, paid_amount, balance_due')
      .eq('property_id', propertyId)
      .not('status', 'in', '("Cancelled","No Show")')
      .gte('check_out', startStr)
      .lte('check_in', endStr);
    
    if (error) return { occupiedNights: 0, totalReservations: 0, avgNightsPerStay: 0 };

    const period = { start: startStr, end: endStr, days };
    const inPeriod = data.filter((r: any) =>
      !isExcludedReservationStatus(r.status) && reservationOverlapsPeriod(r, period)
    );
    const totalNights = inPeriod.reduce((sum: number, r: any) => {
      return sum + prorateReservationToPeriod(r, period).nightsInPeriod;
    }, 0);
    const totalReservations = inPeriod.length;
    const avgNightsPerStay = totalReservations > 0 ? totalNights / totalReservations : 0;
    
    return {
      period: { start: startStr, end: endStr, days },
      occupiedNights: totalNights,
      totalReservations,
      avgNightsPerStay: Math.round(avgNightsPerStay * 10) / 10,
    };
  },

  getTotalMonthlyFixedCosts: async (propertyId: string): Promise<number> => {
    const { data: costs } = await getClient()
      .from('cost_settings')
      .select('fixed_categories, fixed_costs')
      .eq('property_id', propertyId)
      .single();
    
    if (!costs) return 0;
    
    if (costs.fixed_categories && Array.isArray(costs.fixed_categories) && costs.fixed_categories.length > 0) {
      return costs.fixed_categories.reduce((sum: number, cat: any) => sum + (Number(cat.monthlyAmount) || 0), 0);
    }
    
    if (costs.fixed_costs) {
      return calculateTotalFixedCosts(costs.fixed_costs);
    }
    
    return 0;
  },

  getTotalMonthlyVariableCosts: async (propertyId: string): Promise<number> => {
    const { data: costs } = await getClient()
      .from('cost_settings')
      .select('variable_categories, variable_costs')
      .eq('property_id', propertyId)
      .single();
    
    if (!costs) return 0;
    
    if (costs.variable_categories && Array.isArray(costs.variable_categories) && costs.variable_categories.length > 0) {
      return costs.variable_categories.reduce((sum: number, cat: any) => sum + (Number(cat.monthlyAmount) || 0), 0);
    }
    
    if (costs.variable_costs) {
      return (Number(costs.variable_costs.cleaningPerStay) || 0) + 
             (Number(costs.variable_costs.laundryMonthly) || 0) + 
             (Number(costs.variable_costs.amenitiesMonthly) || 0);
    }
    
    return 0;
  },

  getChannelsFromPMS: async (propertyId: string) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = dateToIsoDay(sixMonthsAgo);

    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('source, source_category, room_revenue_total')
      .eq('property_id', propertyId)
      .gte('check_in', cutoff);
    
    if (error) return [];
    
    const channelMap = new Map<string, any>();
    for (const r of data) {
      const source = r.source || 'Directo';
      if (!channelMap.has(source)) {
        channelMap.set(source, {
          name: source,
          reservationCount: 0,
          totalRevenue: 0,
          category: r.source_category || null,
        });
      }
      const ch = channelMap.get(source)!;
      ch.reservationCount++;
      ch.totalRevenue += Number(r.room_revenue_total) || 0;
    }
    
    return Array.from(channelMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  // =====================================================
  // Action Completions (supports both legacy index-based and new string-based IDs)
  // =====================================================
  insertActionCompletion: async (completion: any) => {
    // Support both legacy (actionType + stepIndex) and new (actionId + stepId) formats
    const insertData: any = {
      property_id: completion.propertyId,
      completed_at: completion.completedAt || new Date().toISOString()
    };

    // New format: actionId + stepId (strings)
    if (completion.actionId && completion.stepId) {
      insertData.action_id = completion.actionId;
      insertData.step_id = completion.stepId;
    }
    // Legacy format: actionType + stepIndex (for backend-generated actions)
    if (completion.actionType !== undefined) {
      insertData.action_type = completion.actionType;
    }
    if (completion.stepIndex !== undefined) {
      insertData.step_index = completion.stepIndex;
    }

    const { error } = await getClient()
      .from('action_completions')
      .insert(insertData);
    
    if (error) throw error;
  },
  
  getCompletedSteps: async (propertyId: string, daysBack: number = 30) => {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getClient()
      .from('action_completions')
      .select('*')
      .eq('property_id', propertyId)
      .gte('completed_at', cutoff);
    
    if (error) return [];
    return data;
  },

  // =====================================================
  // Import Log
  // =====================================================
  insertLog: async (log: any) => {
    const { error } = await getClient()
      .from('import_log')
      .insert({
        id: log.id,
        property_id: log.property_id,
        event_type: log.event_type,
        event_data: log.event_data,
        created_at: log.created_at
      });
    
    if (error) {
      console.error('Error inserting log:', error);
      throw error;
    }
  },

  // =====================================================
  // Data Range Detection (para resolver desfase de fechas)
  // =====================================================
  
  // =====================================================
  // Monthly Periods
  // =====================================================

  getOrCreateMonthlyPeriod: async (propertyId: string, month: string) => {
    const { error } = await getClient()
      .from('monthly_periods')
      .upsert(
        { property_id: propertyId, month, status: 'open' },
        { onConflict: 'property_id,month', ignoreDuplicates: true }
      );
    if (error) throw error;

    const { data, error: fetchError } = await getClient()
      .from('monthly_periods')
      .select('*')
      .eq('property_id', propertyId)
      .eq('month', month)
      .single();
    if (fetchError) throw fetchError;
    return data;
  },

  listMonthlyPeriods: async (propertyId: string, limit: number = 12) => {
    const { data, error } = await getClient()
      .from('monthly_periods')
      .select('*')
      .eq('property_id', propertyId)
      .order('month', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data;
  },

  updateMonthlyPeriod: async (propertyId: string, month: string, updates: any) => {
    const { data, error } = await getClient()
      .from('monthly_periods')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('month', month)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =====================================================
  // Monthly Cost Entries
  // =====================================================

  getMonthlyCosts: async (propertyId: string, month: string) => {
    const { data, error } = await getClient()
      .from('monthly_cost_entries')
      .select('*, cost_categories(display_name, sort_order)')
      .eq('property_id', propertyId)
      .eq('month', month)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data;
  },

  upsertMonthlyCosts: async (propertyId: string, month: string, entries: Array<{
    category_key: string;
    cost_type: string;
    amount: number;
    source?: string;
    note?: string;
  }>) => {
    const rows = entries.map(e => ({
      property_id: propertyId,
      month,
      category_key: e.category_key,
      cost_type: e.cost_type,
      amount: e.amount,
      source: e.source || 'manual',
      note: e.note || null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await getClient()
      .from('monthly_cost_entries')
      .upsert(rows, { onConflict: 'property_id,month,category_key,cost_type' })
      .select();

    if (error) throw error;
    return data;
  },

  // =====================================================
  // Monthly Cash Balances
  // =====================================================

  getMonthlyCashBalance: async (propertyId: string, month: string) => {
    const { data, error } = await getClient()
      .from('monthly_cash_balances')
      .select('*')
      .eq('property_id', propertyId)
      .eq('month', month)
      .maybeSingle();

    if (error) return null;
    return data;
  },

  upsertMonthlyCashBalance: async (propertyId: string, month: string, balance: number) => {
    const { data, error } = await getClient()
      .from('monthly_cash_balances')
      .upsert({
        property_id: propertyId,
        month,
        balance,
        as_of_date: new Date().toISOString().substring(0, 10),
        source: 'manual',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'property_id,month' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =====================================================
  // Cost Categories (catalog)
  // =====================================================

  getCostCategories: async () => {
    const { data, error } = await getClient()
      .from('cost_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) return [];
    return data;
  },

  // =====================================================
  // Import Jobs
  // =====================================================

  insertImportJob: async (job: any) => {
    const { data, error } = await getClient()
      .from('import_jobs')
      .insert({
        property_id: job.propertyId,
        job_type: job.jobType,
        source_system: job.sourceSystem || 'pms',
        status: job.status || 'processing',
        target_month: job.targetMonth || null,
        coverage_start: job.coverageStart || null,
        coverage_end: job.coverageEnd || null,
        months_covered: job.monthsCovered || null,
        file_name: job.fileName,
        file_hash: job.fileHash,
        rows_total: job.rowsTotal || 0,
        rows_ok: job.rowsOk || 0,
        rows_error: job.rowsError || 0,
        error_log: job.errorLog || [],
        import_file_id: job.importFileId || null,
        uploaded_by: job.uploadedBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateImportJob: async (id: string, updates: any) => {
    const { error } = await getClient()
      .from('import_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  listImportJobs: async (propertyId: string, options?: { month?: string; limit?: number }) => {
    let query = getClient()
      .from('import_jobs')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 20);

    if (options?.month) {
      query = query.or(`target_month.eq.${options.month},months_covered.cs.{${options.month}}`);
    }

    const { data, error } = await query;
    if (error) return [];
    return data;
  },

  findImportJobByHash: async (propertyId: string, jobType: string, fileHash: string) => {
    const { data, error } = await getClient()
      .from('import_jobs')
      .select('*')
      .eq('property_id', propertyId)
      .eq('job_type', jobType)
      .eq('file_hash', fileHash)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data;
  },

  // =====================================================
  // Data Health & Diagnostics
  // =====================================================

  /**
   * Obtiene información de salud de datos para determinar qué reportes faltan.
   * Usado por el servicio de acciones para sugerir mejoras en la calidad de datos.
   */
  getDataHealth: async (propertyId: string): Promise<{ score: number; issues: string[] }> => {
    const issues: string[] = [];
    let score = 100;
    
    // Verificar si hay reservaciones
    const { count: resCount } = await getClient()
      .from('reservation_financials')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId);
    
    if (!resCount || resCount === 0) {
      issues.push('Importar reporte "Reservations with Financials"');
      score -= 40;
    }
    
    // Verificar si hay transacciones
    const { count: txnCount } = await getClient()
      .from('ledger_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId);
    
    if (!txnCount || txnCount === 0) {
      issues.push('Importar reporte "Expanded Transaction Report"');
      score -= 40;
    }
    
    // Verificar si hay costos configurados
    const { data: costs } = await getClient()
      .from('cost_settings')
      .select('fixed_costs, variable_costs')
      .eq('property_id', propertyId)
      .single();
    
    const hasFixedCosts = costs?.fixed_costs && (
      costs.fixed_costs.salaries > 0 || 
      costs.fixed_costs.rent > 0 || 
      costs.fixed_costs.utilities > 0
    );
    
    if (!hasFixedCosts) {
      issues.push('Configurar costos fijos mensuales');
      score -= 20;
    }
    
    return { score: Math.max(0, score), issues };
  },

  /**
   * Obtiene el rango de fechas de los datos disponibles.
   * Esto es crucial para cuando los datos importados son históricos
   * y no coinciden con el período actual (últimos 30 días).
   * 
   * IMPORTANTE: Para determinar el "último mes" de datos reales, 
   * priorizamos las transacciones sobre las reservaciones, ya que las 
   * reservaciones pueden tener fechas futuras que no representan el estado actual.
   */
  getDataDateRange: async (propertyId: string): Promise<{ 
    reservations: { min: string | null; max: string | null };
    transactions: { min: string | null; max: string | null };
  }> => {
    // Obtener rango de reservaciones (basado en check_in y check_out)
    const { data: resData } = await getClient()
      .from('reservation_financials')
      .select('check_in, check_out')
      .eq('property_id', propertyId)
      .not('status', 'in', '("Cancelled","No Show")');
    
    let resMin: string | null = null;
    let resMax: string | null = null;
    
    if (resData && resData.length > 0) {
      const checkIns = resData.map(r => r.check_in).filter(Boolean).sort();
      const checkOuts = resData.map(r => r.check_out).filter(Boolean).sort();
      resMin = checkIns[0] || null;
      resMax = checkOuts[checkOuts.length - 1] || null;
    }
    
    // Obtener rango de transacciones
    const { data: txnMinData } = await getClient()
      .from('ledger_transactions')
      .select('txn_at')
      .eq('property_id', propertyId)
      .order('txn_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    const { data: txnMaxData } = await getClient()
      .from('ledger_transactions')
      .select('txn_at')
      .eq('property_id', propertyId)
      .order('txn_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return {
      reservations: { min: resMin, max: resMax },
      transactions: { 
        min: txnMinData?.txn_at?.substring(0, 10) || null, 
        max: txnMaxData?.txn_at?.substring(0, 10) || null 
      }
    };
  }
};
