import { supabase, createAuthenticatedClient, hasServiceRoleKey } from './supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  ReportType, 
  calculateTotalFixedCosts,
} from '../types';

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

  getAllReservations: async (propertyId: string) => {
    // Supabase por defecto limita a 1000 registros. Usamos paginación para traer todos.
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await getClient()
        .from('reservation_financials')
        .select('*')
        .eq('property_id', propertyId)
        .range(from, from + PAGE_SIZE - 1)
        .order('check_in', { ascending: false }); // Ordenar por check_in desc para priorizar recientes
      
      if (error) {
        console.error('Error fetching reservations:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE; // Si devuelve menos de PAGE_SIZE, no hay más
      } else {
        hasMore = false;
      }
    }
    
    if (allData.length > 0) {
      console.log(`[DB] Sample reservation: ${allData[0].reservation_number}, CheckIn: ${allData[0].check_in}, Status: ${allData[0].status}`);
    }
    
    console.log(`[DB] Fetched ${allData.length} total reservations from DB for property ${propertyId}`);
    return allData;
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
    // Implement database reset logic here
    // This is a placeholder for the actual implementation
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
    // Supabase por defecto limita a 1000 registros. Usamos paginación.
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      let query = getClient()
        .from('ledger_transactions')
        .select('*')
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
      .select('*')
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

  getReservationsByProperty: async (propertyId: string) => {
    // Supabase por defecto limita a 1000 registros. Usamos paginación.
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await getClient()
        .from('reservation_financials')
        .select('*')
        .eq('property_id', propertyId)
        .range(from, from + PAGE_SIZE - 1)
        .order('check_in', { ascending: false });
      
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

  getReservationsWithBalance: async (propertyId: string, minBalance: number = 0) => {
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('*')
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
      .select('*')
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
    const { data, error } = await getClient()
      .from('cost_settings')
      .upsert({
        property_id: propertyId,
        room_count: settings.roomCount || settings.room_count,
        starting_cash_balance: settings.startingCashBalance || settings.starting_cash_balance,
        variable_categories: settings.variable_categories,
        fixed_categories: settings.fixed_categories,
        extraordinary_costs: settings.extraordinary_costs,
        variable_costs: settings.variable_costs,
        fixed_costs: settings.fixed_costs,
        channel_commissions: settings.channel_commissions,
        payment_fees: settings.payment_fees,
        tax_rules: settings.tax_rules,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  getOccupancyStats: async (propertyId: string, days: number = 30) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().substring(0, 10);
    const endStr = endDate.toISOString().substring(0, 10);
    
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('room_nights')
      .eq('property_id', propertyId)
      .not('status', 'in', '("Cancelled","No Show")')
      .gte('check_in', startStr)
      .lte('check_in', endStr);
    
    if (error) return { occupiedNights: 0, totalReservations: 0, avgNightsPerStay: 0 };
    
    const totalNights = data.reduce((sum, r) => sum + (Number(r.room_nights) || 0), 0);
    const totalReservations = data.length;
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
    const { data, error } = await getClient()
      .from('reservation_financials')
      .select('source, source_category, room_revenue_total')
      .eq('property_id', propertyId);
    
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
