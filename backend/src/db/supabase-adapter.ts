import { supabase } from './supabase-client';
import { 
  ReportType, 
  calculateTotalFixedCosts,
} from '../types';

/**
 * Supabase implementation of the Database interface
 */
export const supabaseDatabase = {
  // =====================================================
  // Properties
  // =====================================================
  getProperty: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .limit(1)
      .single();
    
    if (error) return null;
    return data;
  },

  getPropertyByUser: async (userId: string) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    if (error) return null;
    return data;
  },
  
  getPropertyById: async (id: string) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },
  
  insertProperty: async (property: any) => {
    const { data, error } = await supabase
      .from('properties')
      .insert(property)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  updateProperty: async (id: string, updates: any) => {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    
    if (error) throw error;
    return data;
  },
  
  updateImportFile: async (id: string, updates: any) => {
    const { error } = await supabase
      .from('import_files')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
  },
  
  getImportFilesByProperty: async (propertyId: string, limit: number = 20) => {
    const { data, error } = await supabase
      .from('import_files')
      .select('*')
      .eq('property_id', propertyId)
      .order('uploaded_at', { ascending: false })
      .limit(limit);
    
    if (error) return [];
    return data;
  },
  
  hasReportType: async (propertyId: string, reportType: ReportType): Promise<boolean> => {
    const { count, error } = await supabase
      .from('import_files')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('report_type', reportType)
      .eq('status', 'processed');
    
    if (error) return false;
    return (count || 0) > 0;
  },

  getLastImportByType: async (propertyId: string, reportType: ReportType): Promise<string | null> => {
    const { data, error } = await supabase
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
      row_hash: t.rowHash // Added for UPSERT
    }));

    const { error } = await supabase
      .from('ledger_transactions')
      .upsert(formatted, { onConflict: 'property_id, row_hash' }); // Robust UPSERT (Issue B)
    
    if (error) throw error;
  },
  
  clearTransactionsByFile: async (fileId: string) => {
    const { error } = await supabase
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
      txn_source: t.txnSource
    }));

    // We use a single RPC call if we want true atomicity for delete + insert
    // For now, we'll use the existing methods but wrapped in a way that suggests atomicity
    const { error: deleteError } = await supabase
      .from('ledger_transactions')
      .delete()
      .eq('source_file_id', fileId);
    
    if (deleteError) throw deleteError;

    if (formatted.length > 0) {
      const { error: insertError } = await supabase
        .from('ledger_transactions')
        .insert(formatted);
      
      if (insertError) throw insertError;
    }
  },

  getTransactionsByProperty: async (propertyId: string, startDate?: string, endDate?: string) => {
    let query = supabase
      .from('ledger_transactions')
      .select('*')
      .eq('property_id', propertyId);
    
    if (startDate) query = query.gte('txn_at', startDate);
    if (endDate) query = query.lte('txn_at', endDate);
    
    const { data, error } = await query;
    if (error) return [];
    return data;
  },

  sumCredits: async (propertyId: string, startDate: string, endDate: string): Promise<number> => {
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('credits')
      .eq('property_id', propertyId)
      .gte('txn_at', startDate)
      .lte('txn_at', endDate)
      .eq('void_flag', false);
    
    if (error) return 0;
    return data.reduce((sum, t) => sum + (Number(t.credits) || 0), 0);
  },

  sumDebits: async (propertyId: string, startDate: string, endDate: string): Promise<number> => {
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('debits')
      .eq('property_id', propertyId)
      .gte('txn_at', startDate)
      .lte('txn_at', endDate);
    
    if (error) return 0;
    return data.reduce((sum, t) => sum + (Number(t.debits) || 0), 0);
  },

  getDailyFlow: async (propertyId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('txn_at, credits, debits')
      .eq('property_id', propertyId)
      .gte('txn_at', startDate)
      .lte('txn_at', endDate);
    
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
    const { data, error } = await supabase
      .from('ledger_transactions')
      .select('*')
      .eq('property_id', propertyId)
      .gte('txn_at', startDate)
      .lte('txn_at', endDate)
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
      room_nights: r.roomNights,
      room_revenue_total: r.roomRevenueTotal,
      taxes_total: r.taxesTotal,
      paid_amount: r.paidAmount,
      balance_due: r.balance_due || r.balanceDue,
      suggested_deposit: r.suggested_deposit || r.suggestedDeposit,
      hotel_collect_flag: r.hotelCollectFlag
    }));

    const { error } = await supabase
      .from('reservation_financials')
      .upsert(formatted, { onConflict: 'property_id, reservation_number' });
    
    if (error) throw error;
  },

  clearReservationsByFile: async (fileId: string) => {
    const { error } = await supabase
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
      room_nights: r.roomNights,
      room_revenue_total: r.roomRevenueTotal,
      taxes_total: r.taxesTotal,
      paid_amount: r.paidAmount,
      balance_due: r.balance_due || r.balanceDue,
      suggested_deposit: r.suggested_deposit || r.suggestedDeposit,
      hotel_collect_flag: r.hotelCollectFlag
    }));

    const { error: deleteError } = await supabase
      .from('reservation_financials')
      .delete()
      .eq('source_file_id', fileId);
    
    if (deleteError) throw deleteError;

    if (formatted.length > 0) {
      const { error: insertError } = await supabase
        .from('reservation_financials')
        .insert(formatted);
      
      if (insertError) throw insertError;
    }
  },

  getReservationsByProperty: async (propertyId: string) => {
    const { data, error } = await supabase
      .from('reservation_financials')
      .select('*')
      .eq('property_id', propertyId);
    
    if (error) return [];
    return data;
  },

  getReservationsWithBalance: async (propertyId: string, minBalance: number = 0) => {
    const { data, error } = await supabase
      .from('reservation_financials')
      .select('*')
      .eq('property_id', propertyId)
      .gt('balance_due', minBalance)
      .order('balance_due', { ascending: false });
    
    if (error) return [];
    return data;
  },

  getTotalBalanceDue: async (propertyId: string): Promise<number> => {
    const { data, error } = await supabase
      .from('reservation_financials')
      .select('balance_due')
      .eq('property_id', propertyId)
      .gt('balance_due', 0);
    
    if (error) return 0;
    return data.reduce((sum, r) => sum + (Number(r.balance_due) || 0), 0);
  },

  getDepositGaps: async (propertyId: string) => {
    const { data, error } = await supabase
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

  // =====================================================
  // Channel Summaries
  // =====================================================
  insertChannels: async (channels: any[]) => {
    const formatted = channels.map(c => ({
      property_id: c.propertyId,
      source_file_id: c.sourceFileId,
      source_category: c.sourceCategory,
      source: c.source,
      room_nights: c.roomNights,
      room_revenue_total: c.roomRevenueTotal,
      estimated_commission: c.estimatedCommission
    }));

    const { error } = await supabase
      .from('channel_summaries')
      .insert(formatted);
    
    if (error) throw error;
  },

  clearChannelsByFile: async (fileId: string) => {
    const { error } = await supabase
      .from('channel_summaries')
      .delete()
      .eq('source_file_id', fileId);
    
    if (error) throw error;
  },

  replaceChannelsByFile: async (fileId: string, channels: any[]) => {
    const formatted = channels.map(c => ({
      property_id: c.propertyId,
      source_file_id: c.sourceFileId,
      source_category: c.sourceCategory,
      source: c.source,
      room_nights: c.roomNights,
      room_revenue_total: c.roomRevenueTotal,
      estimated_commission: c.estimatedCommission
    }));

    const { error: deleteError } = await supabase
      .from('channel_summaries')
      .delete()
      .eq('source_file_id', fileId);
    
    if (deleteError) throw deleteError;

    if (formatted.length > 0) {
      const { error: insertError } = await supabase
        .from('channel_summaries')
        .insert(formatted);
      
      if (insertError) throw insertError;
    }
  },

  getChannelsByProperty: async (propertyId: string) => {
    const { data, error } = await supabase
      .from('channel_summaries')
      .select('*')
      .eq('property_id', propertyId);
    
    if (error) return [];
    return data;
  },

  getChannelSummary: async (propertyId: string) => {
    const { data, error } = await supabase
      .from('channel_summaries')
      .select('*')
      .eq('property_id', propertyId);
    
    if (error) return [];
    
    const summary: Record<string, any> = {};
    for (const c of data) {
      const key = c.source;
      if (!summary[key]) {
        summary[key] = {
          source: c.source,
          source_category: c.source_category,
          room_nights: 0,
          room_revenue_total: 0,
          estimated_commission: 0,
        };
      }
      summary[key].room_nights += Number(c.room_nights) || 0;
      summary[key].room_revenue_total += Number(c.room_revenue_total) || 0;
      summary[key].estimated_commission += Number(c.estimated_commission) || 0;
    }
    
    return Object.values(summary).sort((a: any, b: any) => b.room_revenue_total - a.room_revenue_total);
  },

  getChannelSummaryFromReservations: async (propertyId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
      .from('cost_settings')
      .select('*')
      .eq('property_id', propertyId)
      .single();
    
    if (error) return null;
    return data;
  },
  
  upsertCostSettings: async (propertyId: string, settings: any) => {
    const { data, error } = await supabase
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
    
    const { data, error } = await supabase
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
    const { data: costs } = await supabase
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
    const { data: costs } = await supabase
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
    const { data, error } = await supabase
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
  // Action Completions
  // =====================================================
  insertActionCompletion: async (completion: any) => {
    const { error } = await supabase
      .from('action_completions')
      .insert({
        property_id: completion.propertyId,
        action_type: completion.actionType,
        step_index: completion.stepIndex,
        completed_at: completion.completedAt || new Date().toISOString()
      });
    
    if (error) throw error;
  },
  
  getCompletedSteps: async (propertyId: string, daysBack: number = 30) => {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
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
    const { error } = await supabase
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
  
  getLastImport: async (propertyId: string) => {
    const { data, error } = await supabase
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
  
  // =====================================================
  // Data Health Check
  // =====================================================
  getDataHealth: async (propertyId: string) => {
    const { data: files, error } = await supabase
      .from('import_files')
      .select('report_type, status, uploaded_at')
      .eq('property_id', propertyId)
      .eq('status', 'processed');
    
    if (error) return { score: 0, level: 'faltan', issues: ['Error cargando salud de datos'] };

    const hasTransactions = files.some(f => f.report_type === 'expanded_transactions');
    const hasReservations = files.some(f => f.report_type === 'reservations_financials');
    const hasChannels = files.some(f => f.report_type === 'channel_performance');
    
    const lastImport = files.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
    
    const { data: propertyReservations } = await supabase
      .from('reservation_financials')
      .select('check_in')
      .eq('property_id', propertyId);

    let monthsCovered = 0;
    let earliestDate = null;
    let latestDate = null;

    if (propertyReservations && propertyReservations.length > 0) {
      const dates = propertyReservations
        .map(r => r.check_in)
        .filter(Boolean)
        .sort();
      
      if (dates.length > 0) {
        earliestDate = dates[0];
        latestDate = dates[dates.length - 1];
        const start = new Date(earliestDate);
        const end = new Date(latestDate);
        monthsCovered = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      }
    }

    let score = 100;
    const issues: string[] = [];
    
    if (!hasTransactions) { score -= 40; issues.push('Sin Transactions: Falta Expanded Transaction Report'); }
    if (!hasReservations) { score -= 30; issues.push('Sin Performance: Falta Reservations with Financials'); }
    if (!hasChannels) { score -= 20; issues.push('Sin Canales: Falta Channel Performance Summary'); }
    
    if (lastImport) {
      const daysSince = (Date.now() - new Date(lastImport.uploaded_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince > 7) { score -= 10; issues.push('Datos >7 días: El último reporte importado es antiguo'); }
    }

    if (monthsCovered < 3 && hasReservations) {
      issues.push(`Poca historia: Solo tenés ${monthsCovered} ${monthsCovered === 1 ? 'mes' : 'meses'} de datos`);
    }
    
    let level: 'completos' | 'parciales' | 'faltan';
    if (score >= 80) level = 'completos';
    else if (score >= 50) level = 'parciales';
    else level = 'faltan';
    
    return {
      score: Math.max(0, score),
      level,
      issues,
      lastImport: lastImport?.uploaded_at || null,
      hasExpandedTransactions: hasTransactions,
      hasReservationsFinancials: hasReservations,
      hasChannelPerformance: hasChannels,
      monthsCovered,
      earliestDate,
      latestDate,
    };
  }
};
