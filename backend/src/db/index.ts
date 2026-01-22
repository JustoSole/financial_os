import fs from 'fs';
import path from 'path';
import { 
  ReportType, 
  VariableCostsInput,
  FixedCostsInput,
  ChannelCommissions,
  PaymentFees,
  calculateTotalFixedCosts,
} from '../types';

// =====================================================
// JSON-based Database for Financial OS MVS
// =====================================================

interface Database {
  properties: any[];
  import_files: any[];
  ledger_transactions: any[];
  reservation_financials: any[];
  channel_summaries: any[];
  cost_settings: any[];
  action_completions: any[];
  import_log: any[];
}

// Ensure data directory exists
const dataDir = process.env.RENDER_DISK_MOUNT_PATH 
  ? path.join(process.env.RENDER_DISK_MOUNT_PATH)
  : path.join(__dirname, '../../data');

const dbPath = path.join(dataDir, 'financial_os.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load database from file
function loadDb(): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      return { ...emptyDb, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Error loading database:', e);
  }
  return { ...emptyDb };
}

// Save database to file
function saveDb(data: Database): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving database:', e);
  }
}

// In-memory database
let db: Database = loadDb();

// Auto-save on changes (debounced)
let saveTimeout: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveDb(db), 500);
}

function migrateLegacyCostSettingsInDb() {
  let didChange = false;
  for (const settings of db.cost_settings) {
    if (settings?.fixed_costs?.salpiaries !== undefined && settings.fixed_costs.salaries === undefined) {
      settings.fixed_costs.salaries = settings.fixed_costs.salpiaries;
      delete settings.fixed_costs.salpiaries;
      didChange = true;
    }
  }
  if (didChange) {
    scheduleSave();
  }
}

migrateLegacyCostSettingsInDb();

// =====================================================
// Helper Functions
// =====================================================

// Categorize a reservation source into OTA, Direct, or Agencia de Viajes
function categorizeSource(source: string): string {
  const sourceLower = source.toLowerCase();
  
  // Direct channels
  if (['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'website', 'phone', 'direct'].includes(sourceLower)) {
    return 'Direct';
  }
  
  // OTA channels
  if (['booking.com', 'booking', 'expedia', 'despegar', 'decolar', 'despegar/decolar', 'airbnb', 
       'hotels.com', 'agoda', 'tripadvisor', 'kayak', 'trivago', 'hostelworld', 'google'].some(
    ota => sourceLower.includes(ota)
  )) {
    return 'OTA';
  }
  
  // Travel Agency keywords
  if (sourceLower.includes('agencia') || sourceLower.includes('agente') || sourceLower.includes('viajes') ||
      sourceLower.includes('travel') || sourceLower.includes('agency')) {
    return 'Agencia de Viajes';
  }
  
  return 'Otro';
}

// =====================================================
// Migration Helper: Convert old cost settings to V3 (simplified)
// =====================================================

function migrateCostSettings(settings: any) {
  // If already V3 format (has laundryMonthly), return as-is
  if (settings.variable_costs?.laundryMonthly !== undefined) {
    return settings;
  }
  
  const legacySalaries = settings.fixed_costs?.salaries ?? settings.fixed_costs?.salpiaries ?? 0;
  
  // Migrate from V1/V2 to V3
  const migrated = {
    ...settings,
    room_count: settings.room_count || 0,
    variable_costs: {
      cleaningPerStay: settings.variable_costs?.cleaningPerStay || settings.cleaning_cost_per_stay || 0,
      laundryMonthly: 0,  // User needs to input this
      amenitiesMonthly: 0, // User needs to input this
    },
    fixed_costs: {
      salaries: legacySalaries,
      rent: settings.fixed_costs?.rent || 0,
      utilities: (settings.fixed_costs?.utilitiesBase || 0) + (settings.fixed_costs?.software || 0),
      other: (settings.fixed_costs?.maintenance || 0) + (settings.fixed_costs?.marketing || 0) + (settings.fixed_costs?.other || settings.monthly_fixed_costs || 0),
    },
    channel_commissions: settings.channel_commissions || {
      defaultRate: settings.default_ota_commission_rate || 0.15,
      byChannel: settings.channel_commission_overrides || {},
    },
    payment_fees: settings.payment_fees || {
      enabled: true,
      defaultRate: 0.035,
      byMethod: {},
    },
  };
  
  return migrated;
}

// =====================================================
// Database Operations
// =====================================================

export const database = {
  // =====================================================
  // Properties
  // =====================================================
  getProperty: () => db.properties[0] || null,
  
  getPropertyById: (id: string) => db.properties.find(p => p.id === id) || null,
  
  insertProperty: (property: any) => {
    db.properties.push(property);
    scheduleSave();
    return property;
  },
  
  updateProperty: (id: string, updates: any) => {
    const index = db.properties.findIndex(p => p.id === id);
    if (index !== -1) {
      db.properties[index] = { ...db.properties[index], ...updates };
      scheduleSave();
      return db.properties[index];
    }
    return null;
  },

  // =====================================================
  // Import Files
  // =====================================================
  insertImportFile: (file: any) => {
    db.import_files.push(file);
    scheduleSave();
    return file;
  },
  
  updateImportFile: (id: string, updates: any) => {
    const index = db.import_files.findIndex(f => f.id === id);
    if (index !== -1) {
      db.import_files[index] = { ...db.import_files[index], ...updates };
      scheduleSave();
    }
  },
  
  getImportFilesByProperty: (propertyId: string, limit: number = 20) => {
    return db.import_files
      .filter(f => f.property_id === propertyId)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .slice(0, limit);
  },
  
  hasReportType: (propertyId: string, reportType: ReportType): boolean => {
    return db.import_files.some(f => 
      f.property_id === propertyId && 
      f.report_type === reportType && 
      f.status === 'processed'
    );
  },
  
  getLastImportByType: (propertyId: string, reportType: ReportType): string | null => {
    const files = db.import_files
      .filter(f => f.property_id === propertyId && f.report_type === reportType && f.status === 'processed')
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    return files[0]?.uploaded_at || null;
  },

  // =====================================================
  // Ledger Transactions (from Expanded Transaction Report)
  // =====================================================
  insertTransactions: (transactions: any[]) => {
    db.ledger_transactions.push(...transactions);
    scheduleSave();
  },
  
  clearTransactionsByFile: (fileId: string) => {
    db.ledger_transactions = db.ledger_transactions.filter(t => t.source_file_id !== fileId);
    scheduleSave();
  },
  
  getTransactionsByProperty: (propertyId: string, startDate?: string, endDate?: string) => {
    return db.ledger_transactions.filter(t => {
      if (t.property_id !== propertyId) return false;
      const txnDate = t.txn_at.substring(0, 10);
      if (startDate && txnDate < startDate) return false;
      if (endDate && txnDate > endDate) return false;
      return true;
    });
  },
  
  /**
   * Sum Credits (Cobrado) - excluding void
   */
  sumCredits: (propertyId: string, startDate: string, endDate: string): number => {
    const transactions = db.ledger_transactions.filter(t => {
      if (t.property_id !== propertyId) return false;
      const txnDate = t.txn_at.substring(0, 10);
      if (txnDate < startDate || txnDate > endDate) return false;
      return true;
    });
    return transactions.reduce((sum, t) => sum + (t.credits || 0), 0);
  },
  
  /**
   * Sum Debits (Cargado)
   */
  sumDebits: (propertyId: string, startDate: string, endDate: string): number => {
    const transactions = db.ledger_transactions.filter(t => {
      if (t.property_id !== propertyId) return false;
      const txnDate = t.txn_at.substring(0, 10);
      if (txnDate < startDate || txnDate > endDate) return false;
      return true;
    });
    return transactions.reduce((sum, t) => sum + (t.debits || 0), 0);
  },
  
  /**
   * Get daily flow (credits and debits by day)
   */
  getDailyFlow: (propertyId: string, startDate: string, endDate: string) => {
    const transactions = db.ledger_transactions.filter(t => {
      if (t.property_id !== propertyId) return false;
      const txnDate = t.txn_at.substring(0, 10);
      if (txnDate < startDate || txnDate > endDate) return false;
      return true;
    });
    
    // Group by date
    const byDate: Record<string, { credits: number; debits: number }> = {};
    for (const t of transactions) {
      const date = t.txn_at.substring(0, 10);
      if (!byDate[date]) {
        byDate[date] = { credits: 0, debits: 0 };
      }
      byDate[date].credits += t.credits || 0;
      byDate[date].debits += t.debits || 0;
    }
    
    // Convert to array sorted by date
    return Object.entries(byDate)
      .map(([date, { credits, debits }]) => ({
        date,
        credits,
        debits,
        netFlow: credits - debits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  
  /**
   * Get alerts (refunds, voids, adjustments)
   */
  getAlerts: (propertyId: string, startDate: string, endDate: string) => {
    const transactions = db.ledger_transactions.filter(t => {
      if (t.property_id !== propertyId) return false;
      const txnDate = t.txn_at.substring(0, 10);
      if (txnDate < startDate || txnDate > endDate) return false;
      return t.refund_flag || t.adjustment_flag;
    });
    
    const refunds = transactions.filter(t => t.refund_flag);
    const adjustments = transactions.filter(t => t.adjustment_flag);
    
    const alerts = [];
    if (refunds.length > 0) {
      alerts.push({
        type: 'refund',
        count: refunds.length,
        amount: refunds.reduce((sum, t) => sum + (t.credits || 0), 0),
        description: `${refunds.length} reembolsos en el período`,
      });
    }
    if (adjustments.length > 0) {
      alerts.push({
        type: 'adjustment',
        count: adjustments.length,
        amount: adjustments.reduce((sum, t) => sum + Math.abs((t.debits || 0) - (t.credits || 0)), 0),
        description: `${adjustments.length} ajustes en el período`,
      });
    }
    
    return alerts;
  },

  // =====================================================
  // Reservation Financials
  // =====================================================
  insertReservations: (reservations: any[]) => {
    // Upsert by reservation number
    for (const res of reservations) {
      const existingIndex = db.reservation_financials.findIndex(
        r => r.property_id === res.property_id && r.reservation_number === res.reservation_number
      );
      if (existingIndex !== -1) {
        db.reservation_financials[existingIndex] = res;
      } else {
        db.reservation_financials.push(res);
      }
    }
    scheduleSave();
  },
  
  clearReservationsByFile: (fileId: string) => {
    db.reservation_financials = db.reservation_financials.filter(r => r.source_file_id !== fileId);
    scheduleSave();
  },
  
  getReservationsByProperty: (propertyId: string) => {
    return db.reservation_financials.filter(r => r.property_id === propertyId);
  },
  
  /**
   * Get reservations with balance due (for collections)
   */
  getReservationsWithBalance: (propertyId: string, minBalance: number = 0) => {
    return db.reservation_financials
      .filter(r => r.property_id === propertyId && r.balance_due > minBalance)
      .sort((a, b) => b.balance_due - a.balance_due);
  },
  
  /**
   * Get total balance due
   */
  getTotalBalanceDue: (propertyId: string): number => {
    return db.reservation_financials
      .filter(r => r.property_id === propertyId && r.balance_due > 0)
      .reduce((sum, r) => sum + r.balance_due, 0);
  },
  
  /**
   * Get reservations with deposit gap (paid < suggested)
   */
  getDepositGaps: (propertyId: string) => {
    return db.reservation_financials
      .filter(r => {
        if (r.property_id !== propertyId) return false;
        const gap = r.suggested_deposit - r.paid_amount;
        return gap > 0 && r.status !== 'Cancelled';
      })
      .map(r => ({
        ...r,
        deposit_gap: r.suggested_deposit - r.paid_amount,
      }))
      .sort((a, b) => b.deposit_gap - a.deposit_gap);
  },

  // =====================================================
  // Channel Summaries
  // =====================================================
  insertChannels: (channels: any[]) => {
    db.channel_summaries.push(...channels);
    scheduleSave();
  },
  
  clearChannelsByFile: (fileId: string) => {
    db.channel_summaries = db.channel_summaries.filter(c => c.source_file_id !== fileId);
    scheduleSave();
  },
  
  getChannelsByProperty: (propertyId: string) => {
    return db.channel_summaries.filter(c => c.property_id === propertyId);
  },
  
  /**
   * Get channel summary aggregated by source (static data from Channel Performance CSV)
   */
  getChannelSummary: (propertyId: string) => {
    const channels = db.channel_summaries.filter(c => c.property_id === propertyId);
    
    // Group by source
    const summary: Record<string, any> = {};
    for (const c of channels) {
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
      summary[key].room_nights += c.room_nights || 0;
      summary[key].room_revenue_total += c.room_revenue_total || 0;
      summary[key].estimated_commission += c.estimated_commission || 0;
    }
    
    return Object.values(summary).sort((a: any, b: any) => b.room_revenue_total - a.room_revenue_total);
  },
  
  /**
   * Get channel summary from reservations filtered by date range
   * This is the PRIMARY source for date-filtered channel metrics
   */
  getChannelSummaryFromReservations: (propertyId: string, startDate: string, endDate: string) => {
    const reservations = db.reservation_financials.filter(r => {
      if (r.property_id !== propertyId) return false;
      if (r.status === 'Cancelled') return false;
      
      // Filter by check-in date within range
      const checkIn = r.check_in?.substring(0, 10);
      if (!checkIn) return false;
      if (checkIn < startDate || checkIn > endDate) return false;
      return true;
    });
    
    // Group by source
    const summary: Record<string, any> = {};
    for (const r of reservations) {
      const source = r.source || 'Desconocido';
      const key = source;
      if (!summary[key]) {
        summary[key] = {
          source: source,
          source_category: r.source_category || categorizeSource(source),
          room_nights: 0,
          room_revenue_total: 0,
          estimated_commission: 0,
        };
      }
      summary[key].room_nights += r.room_nights || 0;
      summary[key].room_revenue_total += r.room_revenue_total || 0;
      // Commission will be calculated by the service using rates
    }
    
    return Object.values(summary).sort((a: any, b: any) => b.room_revenue_total - a.room_revenue_total);
  },

  // =====================================================
  // Cost Settings V4 (Flexible Categories)
  // =====================================================
  getCostSettings: (propertyId: string) => {
    const settings = db.cost_settings.find(c => c.property_id === propertyId);
    if (!settings) return null;
    
    // Migrate old format to V4 if needed
    return migrateCostSettings(settings);
  },
  
  upsertCostSettings: (propertyId: string, settings: any) => {
    const existingIndex = db.cost_settings.findIndex(c => c.property_id === propertyId);
    
    // Default V4 structure with flexible categories
    const defaultSettings = {
      property_id: propertyId,
      room_count: 0,
      starting_cash_balance: 0,
      // V4 flexible categories
      variable_categories: [],
      fixed_categories: [],
      // Legacy V3 fields (for backward compatibility)
      variable_costs: {
        cleaningPerStay: 0,
        laundryMonthly: 0,
        amenitiesMonthly: 0,
      },
      fixed_costs: {
        salaries: 0,
        rent: 0,
        utilities: 0,
        other: 0,
      },
      channel_commissions: {
        defaultRate: 0.15,
        byChannel: {},
      },
      payment_fees: {
        enabled: false,
        defaultRate: 0.035,
        byMethod: {},
      },
      updated_at: new Date().toISOString(),
    };
    
    const normalizedFixedCosts = settings.fixed_costs
      ? {
          ...settings.fixed_costs,
          salaries: settings.fixed_costs.salaries ?? settings.fixed_costs.salpiaries ?? 0,
        }
      : undefined;

    if (existingIndex !== -1) {
      const existing = db.cost_settings[existingIndex];
      db.cost_settings[existingIndex] = {
        ...defaultSettings,
        ...existing,
        ...settings,
        room_count: settings.roomCount !== undefined ? settings.roomCount : (settings.room_count !== undefined ? settings.room_count : existing.room_count || 0),
        // V4 flexible categories - replace entirely if provided
        variable_categories: settings.variable_categories || existing.variable_categories || [],
        fixed_categories: settings.fixed_categories || existing.fixed_categories || [],
        // Legacy V3 fields
        variable_costs: {
          ...defaultSettings.variable_costs,
          ...(existing.variable_costs || {}),
          ...(settings.variable_costs || {}),
        },
        fixed_costs: {
          ...defaultSettings.fixed_costs,
          ...(existing.fixed_costs || {}),
          ...(normalizedFixedCosts || {}),
        },
        channel_commissions: {
          ...defaultSettings.channel_commissions,
          ...(existing.channel_commissions || {}),
          ...(settings.channel_commissions || {}),
          byChannel: {
            ...(existing.channel_commissions?.byChannel || {}),
            ...(settings.channel_commissions?.byChannel || {}),
          },
        },
        payment_fees: {
          ...defaultSettings.payment_fees,
          ...(existing.payment_fees || {}),
          ...(settings.payment_fees || {}),
          byMethod: {
            ...(existing.payment_fees?.byMethod || {}),
            ...(settings.payment_fees?.byMethod || {}),
          },
        },
        updated_at: new Date().toISOString(),
      };
    } else {
      db.cost_settings.push({
        ...defaultSettings,
        ...settings,
      });
    }
    scheduleSave();
    return db.cost_settings.find(c => c.property_id === propertyId);
  },
  
  // Get occupancy stats from PMS data (for auto-calculation)
  getOccupancyStats: (propertyId: string, days: number = 30) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().substring(0, 10);
    const endStr = endDate.toISOString().substring(0, 10);
    
    const reservations = db.reservation_financials.filter(r => {
      if (r.property_id !== propertyId) return false;
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      if (!checkIn) return false;
      return checkIn >= startStr && checkIn <= endStr;
    });
    
    const totalNights = reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const totalReservations = reservations.length;
    const avgNightsPerStay = totalReservations > 0 ? totalNights / totalReservations : 0;
    
    return {
      period: { start: startStr, end: endStr, days },
      occupiedNights: totalNights,
      totalReservations,
      avgNightsPerStay: Math.round(avgNightsPerStay * 10) / 10,
    };
  },
  
  // Helper to get total monthly fixed costs (V4 compatible)
  getTotalMonthlyFixedCosts: (propertyId: string): number => {
    const settings = db.cost_settings.find(c => c.property_id === propertyId);
    if (!settings) return 0;
    
    // Use V4 flexible categories if available
    if (settings.fixed_categories && settings.fixed_categories.length > 0) {
      return settings.fixed_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    }
    
    // Fall back to legacy V3 fixed_costs
    if (settings.fixed_costs) {
      return calculateTotalFixedCosts(settings.fixed_costs);
    }
    
    return 0;
  },
  
  // Helper to get total monthly variable costs (V4 compatible)
  getTotalMonthlyVariableCosts: (propertyId: string): number => {
    const settings = db.cost_settings.find(c => c.property_id === propertyId);
    if (!settings) return 0;
    
    // Use V4 flexible categories if available
    if (settings.variable_categories && settings.variable_categories.length > 0) {
      return settings.variable_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    }
    
    // Fall back to legacy V3 variable_costs
    if (settings.variable_costs) {
      return (settings.variable_costs.cleaningPerStay || 0) + 
             (settings.variable_costs.laundryMonthly || 0) + 
             (settings.variable_costs.amenitiesMonthly || 0);
    }
    
    return 0;
  },

  // Get unique channels from PMS data (reservations)
  getChannelsFromPMS: (propertyId: string) => {
    const reservations = db.reservation_financials.filter(r => r.property_id === propertyId);
    
    // Aggregate by source
    const channelMap = new Map<string, { 
      name: string; 
      reservationCount: number; 
      totalRevenue: number;
      category: string | null;
    }>();
    
    for (const r of reservations) {
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
      ch.totalRevenue += r.room_revenue_total || 0;
    }
    
    // Convert to array and sort by revenue
    return Array.from(channelMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  // =====================================================
  // Action Completions
  // =====================================================
  insertActionCompletion: (completion: any) => {
    db.action_completions.push(completion);
    scheduleSave();
  },
  
  getCompletedSteps: (propertyId: string, daysBack: number = 30) => {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    return db.action_completions.filter(c => 
      c.property_id === propertyId && c.completed_at >= cutoff
    );
  },

  // =====================================================
  // Import Log
  // =====================================================
  insertLog: (log: any) => {
    db.import_log.push(log);
    scheduleSave();
  },
  
  getLastImport: (propertyId: string) => {
    const successful = db.import_files
      .filter(f => f.property_id === propertyId && f.status === 'processed')
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    return successful[0]?.uploaded_at || null;
  },
  
  // =====================================================
  // Data Health Check
  // =====================================================
  getDataHealth: (propertyId: string) => {
    const hasTransactions = db.import_files.some(f => 
      f.property_id === propertyId && 
      f.report_type === 'expanded_transactions' && 
      f.status === 'processed'
    );
    const hasReservations = db.import_files.some(f => 
      f.property_id === propertyId && 
      f.report_type === 'reservations_financials' && 
      f.status === 'processed'
    );
    const hasChannels = db.import_files.some(f => 
      f.property_id === propertyId && 
      f.report_type === 'channel_performance' && 
      f.status === 'processed'
    );
    
    const lastImport = db.import_files
      .filter(f => f.property_id === propertyId && f.status === 'processed')
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
    
    // Calculate date coverage from reservations
    const propertyReservations = db.reservation_financials.filter(r => r.property_id === propertyId);
    let monthsCovered = 0;
    let earliestDate = null;
    let latestDate = null;

    if (propertyReservations.length > 0) {
      const dates = propertyReservations
        .map(r => r.check_in?.substring(0, 10))
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

    // Calculate score per spec (Section 61)
    let score = 100;
    const issues: string[] = [];
    
    if (!hasTransactions) {
      score -= 40;
      issues.push('Sin Transactions: Falta Expanded Transaction Report');
    }
    if (!hasReservations) {
      score -= 30;
      issues.push('Sin Performance: Falta Reservations with Financials');
    }
    if (!hasChannels) {
      score -= 20;
      issues.push('Sin Canales: Falta Channel Performance Summary');
    }
    
    if (lastImport) {
      const daysSince = (Date.now() - new Date(lastImport.uploaded_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince > 7) {
        score -= 10;
        issues.push('Datos >7 días: El último reporte importado es antiguo');
      }
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
  },
};

export function initializeDatabase() {
  console.log('✓ Database initialized (JSON storage)');
}

export default database;
