import database from '../db';
import { getVariableCostPerNight } from './costs-utils';
import logger from './logger';
import { 
  DatePeriod, 
  StructureMetrics, 
  ReservationEconomicsSummary,
  ChannelMetrics,
  DEFAULT_CHANNEL_COMMISSIONS,
  HomeMetrics,
  TrustLevel
} from '../types';

/**
 * Single Source of Truth for Financial Calculations
 * Centralizes logic to ensure consistency across Home, CommandCenter, and Profitability views.
 * 
 * IMPORTANTE: Este engine detecta automáticamente el rango de datos disponibles.
 * Si el período solicitado no tiene datos pero existen datos históricos,
 * el engine ajustará el período para mostrar los datos disponibles.
 */
export class CalculationEngine {
  private propertyId: string;
  private period: DatePeriod;
  private originalPeriod: DatePeriod; // El período originalmente solicitado
  private costSettings: any;
  private reservations: any[] = [];
  private allReservations: any[] = []; // Todas las reservaciones sin filtrar (para proyecciones)
  private transactions: any[] = [];
  private importFiles: any[] = [];
  private usedFallbackPeriod: boolean = false; // Indica si se usó un período alternativo
  
  constructor(propertyId: string, period: DatePeriod) {
    this.propertyId = propertyId;
    this.period = period;
    this.originalPeriod = { ...period };
  }

  /**
   * Initialize engine with data.
   * 
   * FEATURE: Auto-detección de rango de datos.
   * Si no hay datos en el período solicitado pero sí hay datos históricos,
   * el engine usa automáticamente el período de los últimos N días de datos disponibles.
   */
  async init() {
    logger.debug('ENGINE', `Initializing for period: ${this.period.start} to ${this.period.end}`);
    
    // 1. Cargar configuración y archivos de importación
    const [settings, importFiles] = await Promise.all([
      database.getCostSettings(this.propertyId),
      database.getImportFiles(this.propertyId)
    ]);
    
    this.costSettings = settings;
    this.importFiles = importFiles;
    
    // 2. Cargar TODAS las reservaciones para verificar disponibilidad
    const allReservations = await database.getAllReservations(this.propertyId);
    
    // Guardar todas las reservaciones (sin canceladas) para proyecciones futuras
    this.allReservations = allReservations.filter((r: any) => 
      r.status !== 'Cancelled' && r.status !== 'No Show'
    );
    
    // 3. Filtrar reservaciones por período original
    let filteredReservations = this.filterReservationsByPeriod(allReservations, this.period);
    
    // 4. AUTO-DETECCIÓN: Si no hay datos en el período actual, buscar datos históricos
    if (filteredReservations.length === 0 && allReservations.length > 0) {
      logger.info('ENGINE', `No data in requested period. Detecting available data range...`);
      
      // Obtener rango de datos disponibles
      const dataRange = await database.getDataDateRange(this.propertyId);
      
      // PRIORIDAD: Si el usuario pide un periodo y no hay nada, buscamos el último bloque de datos real.
      // No capamos a "hoy" si los datos son puramente históricos, para permitir análisis de meses pasados.
      const latestDataDate = dataRange.transactions.max || dataRange.reservations.max;
      
      if (latestDataDate) {
        const referenceDate = new Date(latestDataDate);
        
        // Calcular un período basado en los últimos N días de datos disponibles
        const latestDate = referenceDate;
        const earliestDate = new Date(dataRange.transactions.min || dataRange.reservations.min || latestDataDate);
        
        // Usar el mismo número de días que el período original
        const requestedDays = this.originalPeriod.days || 30;
        const adjustedEndDate = latestDate;
        const adjustedStartDate = new Date(latestDate.getTime() - (requestedDays * 24 * 60 * 60 * 1000));
        
        // Si la fecha ajustada es anterior a los primeros datos, usar esa fecha
        const finalStartDate = adjustedStartDate < earliestDate ? earliestDate : adjustedStartDate;
        
        const newPeriod: DatePeriod = {
          start: finalStartDate.toISOString().substring(0, 10),
          end: adjustedEndDate.toISOString().substring(0, 10),
          days: Math.ceil((adjustedEndDate.getTime() - finalStartDate.getTime()) / (24 * 60 * 60 * 1000))
        };
        
        logger.info('ENGINE', `FALLBACK: Using historical data period: ${newPeriod.start} to ${newPeriod.end}`);
        
        this.period = newPeriod;
        this.usedFallbackPeriod = true;
        
        // Re-filtrar con el nuevo período
        filteredReservations = this.filterReservationsByPeriod(allReservations, this.period);
      }
    }
    
    // 5. Cargar transacciones del período (ya sea original o ajustado)
    this.transactions = await database.getTransactionsByProperty(this.propertyId, this.period.start, this.period.end);
    
    // 6. Aplicar prorrateo a las reservaciones filtradas
    this.reservations = filteredReservations.map(r => this.prorateReservation(r));

    logger.info('ENGINE', `Initialized with ${this.reservations.length} reservations and ${this.transactions.length} transactions.`);
    
    if (this.usedFallbackPeriod) {
      logger.info('ENGINE', `⚠️ NOTA: Se usó período histórico automático porque no había datos en el período solicitado (${this.originalPeriod.start} a ${this.originalPeriod.end}).`);
    }
  }

  /**
   * Filtra reservaciones por período con lógica de solapamiento.
   */
  private filterReservationsByPeriod(reservations: any[], period: DatePeriod): any[] {
    return reservations.filter((r: any) => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      const checkOut = r.check_out?.substring(0, 10);
      
      // Una reserva matchea si hay solapamiento con el período
      const isMatch = checkIn <= period.end && checkOut > period.start;
      
      return isMatch;
    });
  }

  /**
   * Aplica prorrateo a una reservación según el período.
   */
  private prorateReservation(r: any): any {
    const checkIn = new Date(r.check_in);
    const checkOut = new Date(r.check_out);
    const periodStart = new Date(this.period.start);
    const periodEnd = new Date(this.period.end);
    
    const actualStart = checkIn > periodStart ? checkIn : periodStart;
    const actualEnd = checkOut < periodEnd ? checkOut : periodEnd;
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const nightsInPeriod = Math.max(0, Math.ceil((actualEnd.getTime() - actualStart.getTime()) / msPerDay));
    const totalNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / msPerDay));
    const ratio = nightsInPeriod / totalNights;
    
    return {
      ...r,
      room_nights: nightsInPeriod,
      room_revenue_total: (Number(r.room_revenue_total) || 0) * ratio,
      taxes_total: (Number(r.taxes_total) || 0) * ratio,
      original_room_nights: totalNights,
      original_room_revenue: Number(r.room_revenue_total) || 0
    };
  }

  /**
   * Indica si el engine usó un período de fallback.
   */
  isUsingFallbackPeriod(): boolean {
    return this.usedFallbackPeriod;
  }

  /**
   * Obtiene el período efectivo que se está usando.
   */
  getEffectivePeriod(): DatePeriod {
    return this.period;
  }

  /**
   * Obtiene el período originalmente solicitado.
   */
  getOriginalPeriod(): DatePeriod {
    return this.originalPeriod;
  }

  getDataHealth() {
    const hasTransactions = this.importFiles.some(f => f.report_type === 'expanded_transactions');
    const hasReservations = this.importFiles.some(f => f.report_type === 'reservations_financials');
    
    const lastImport = [...this.importFiles].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
    
    let score = 100;
    const issues: string[] = [];
    
    if (!hasTransactions) { score -= 50; issues.push('Sin Transactions: Falta Expanded Transaction Report'); }
    if (!hasReservations) { score -= 50; issues.push('Sin Performance: Falta Reservations with Financials'); }
    
    if (lastImport) {
      const daysSince = (Date.now() - new Date(lastImport.uploaded_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince > 7) { score -= 10; issues.push('Datos >7 días: El último reporte importado es antiguo'); }
    }

    // Indicar si se está usando un período de fallback
    if (this.usedFallbackPeriod) {
      issues.push(`📊 Mostrando datos históricos: ${this.period.start} a ${this.period.end}`);
    }

    // Calcular meses cubiertos (aproximado)
    let monthsCovered = 0;
    let earliestDate = null;
    
    // Usar todas las reservaciones para calcular el rango total de datos
    const resDates = this.allReservations.map(r => r.check_in).filter(Boolean).sort();
    
    // Para transacciones, idealmente querríamos todas, pero aquí solo tenemos las del período.
    // Sin embargo, si tenemos 3 años de reservaciones, monthsCovered ya será > 1.
    const allDates = [...resDates].sort();
    if (allDates.length > 0) {
      earliestDate = allDates[0].substring(0, 10);
      const latestDate = allDates[allDates.length - 1].substring(0, 10);
      
      const start = new Date(earliestDate);
      const end = new Date(latestDate);
      monthsCovered = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
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
      // Nuevos campos para informar sobre el período
      isUsingHistoricalData: this.usedFallbackPeriod,
      effectivePeriod: this.usedFallbackPeriod ? this.period : null,
      requestedPeriod: this.usedFallbackPeriod ? this.originalPeriod : null,
      monthsCovered,
      earliestDate,
      // Optional fields in shared type
      hasChannelPerformance: false,
    };
  }

  /**
   * Get Home Metrics
   */
  getHomeMetrics(): HomeMetrics {
    const profitability = this.getProfitability();
    const dataHealth = this.getDataHealth();
    
    const cobrado = this.transactions.reduce((sum, t) => sum + (Number(t.credits) || 0), 0);
    const pendiente = this.reservations.reduce((sum, r) => sum + (Number(r.balance_due) || 0), 0);
    
    const txnTrust: TrustLevel = dataHealth.hasExpandedTransactions ? 'real' : 'incompleto';
    const resTrust: TrustLevel = dataHealth.hasReservationsFinancials ? 'real' : 'incompleto';

    // Usar el período efectivo (puede ser el original o el de fallback histórico)
    const effectivePeriod = this.getEffectivePeriod();

    // Calculate projections for the "mirror" period (next N days)
    const projections = this.calculateProjections();

    return {
      period: effectivePeriod,
      cobrado: {
        value: Math.round(cobrado),
        previousValue: null,
        delta: null,
        trust: txnTrust,
        source: 'Expanded Transaction Report',
        explainFormula: 'SUM(Credits) de todas las transacciones cobradas en el período',
      },
      cargado: {
        value: Math.round(profitability.totalRevenue),
        previousValue: null,
        delta: null,
        trust: resTrust,
        source: 'Reservations with Financials (Prorrateado)',
        explainFormula: 'Revenue de noches que caen dentro del período',
      },
      pendiente: {
        value: Math.round(pendiente),
        previousValue: null,
        delta: null,
        trust: resTrust,
        source: 'Reservations with Financials',
        explainFormula: 'SUM(balance_due) de todas las reservas con saldo.',
      },
      ahorroPotencial: {
        value: 0, // Simplified for now
        previousValue: null,
        delta: null,
        trust: 'estimado',
        source: 'Mix de canales del período',
        explainFormula: '',
      },
      dataHealth,
      projections
    };
  }

  /**
   * Calcula proyecciones para los próximos N días (período espejo).
   * Usa allReservations (no filtradas por período) para acceder a reservaciones futuras.
   */
  private calculateProjections() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().substring(0, 10);
    
    // Definir el período espejo (próximos N días)
    const msPerDay = 24 * 60 * 60 * 1000;
    const requestedDays = this.originalPeriod.days || 30;
    
    const mirrorStart = today;
    const mirrorEnd = new Date(today.getTime() + (requestedDays * msPerDay));
    
    const mirrorStartStr = mirrorStart.toISOString().substring(0, 10);
    const mirrorEndStr = mirrorEnd.toISOString().substring(0, 10);
    
    // 1. Filtrar reservaciones FUTURAS usando allReservations (no las filtradas por período)
    const upcomingReservations = this.allReservations.filter(r => {
      const checkIn = r.check_in?.substring(0, 10);
      const checkOut = r.check_out?.substring(0, 10);
      // Reservación solapa con el período futuro
      return checkIn <= mirrorEndStr && checkOut > mirrorStartStr;
    });

    // 2. Calcular ingresos proyectados (prorrateados al período futuro)
    let projectedRevenue = 0;
    let occupiedNights = 0;
    
    upcomingReservations.forEach(r => {
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      const actualStart = checkIn > mirrorStart ? checkIn : mirrorStart;
      const actualEnd = checkOut < mirrorEnd ? checkOut : mirrorEnd;
      
      const nightsInPeriod = Math.max(0, Math.ceil((actualEnd.getTime() - actualStart.getTime()) / msPerDay));
      const totalNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / msPerDay));
      const ratio = nightsInPeriod / totalNights;
      
      projectedRevenue += (Number(r.room_revenue_total) || 0) * ratio;
      occupiedNights += nightsInPeriod;
    });

    // 3. Ocupación proyectada
    const roomCount = this.costSettings?.room_count || 1;
    const totalPossibleNights = roomCount * requestedDays;
    const projectedOccupancy = totalPossibleNights > 0 ? occupiedNights / totalPossibleNights : 0;

    // 4. Booking Window (Anticipación) - usar created_at como proxy de fecha de reserva
    let totalLeadTime = 0;
    let leadTimeCount = 0;
    
    this.allReservations.forEach(r => {
      // Usar reservation_date si existe, sino usar created_at como proxy
      const bookingDate = r.reservation_date || r.created_at;
      if (bookingDate && r.check_in) {
        const resDate = new Date(bookingDate);
        const checkIn = new Date(r.check_in);
        const diff = Math.ceil((checkIn.getTime() - resDate.getTime()) / msPerDay);
        // Solo contar si check_in es posterior a la fecha de reserva y es razonable (<365 días)
        if (diff > 0 && diff < 365) {
          totalLeadTime += diff;
          leadTimeCount++;
        }
      }
    });
    
    const avgBookingWindow = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;

    // 5. Total OTB (On The Books) - Todo lo futuro desde hoy usando allReservations
    const allFutureRes = this.allReservations.filter(r => r.check_in?.substring(0, 10) >= todayStr);
    const totalOTB = allFutureRes.reduce((sum, r) => sum + (Number(r.room_revenue_total) || 0), 0);

    // 6. Cierre de mes estimado
    const cobrado = this.transactions.reduce((sum, t) => sum + (Number(t.credits) || 0), 0);
    const estimatedMonthEnd = cobrado + projectedRevenue;

    const result = {
      projectedRevenue: Math.round(projectedRevenue),
      projectedOccupancy: Math.round(projectedOccupancy * 100) / 100,
      avgBookingWindow: Math.round(avgBookingWindow * 10) / 10,
      totalOTB: Math.round(totalOTB),
      estimatedMonthEnd: Math.round(estimatedMonthEnd)
    };
    
    logger.debug('ENGINE', 'Projections calculated', {
      period: `${mirrorStartStr} to ${mirrorEndStr}`,
      upcomingReservations: upcomingReservations.length,
      allFutureRes: allFutureRes.length,
      ...result
    });
    
    return result;
  }

  /**
   * Get all reservations (filtered by period)
   */
  getReservations() {
    return this.reservations;
  }

  /**
   * 1. Structure Metrics (Volume & Revenue)
   */
  getStructureMetrics(): StructureMetrics {
    const roomCount = this.costSettings?.room_count || 0;
    const totalNights = this.reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const totalRevenue = this.reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    const effectivePeriod = this.getEffectivePeriod();
    const availableNights = roomCount * effectivePeriod.days;
    
    const occupancyRate = availableNights > 0 ? (totalNights / availableNights) * 100 : 0;
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
    
    return {
      period: effectivePeriod,
      occupancyRate: Math.min(100, occupancyRate), // No rounding here
      ADR: adr, // No rounding here
      RevPAR: availableNights > 0 ? totalRevenue / availableNights : 0, // No rounding here
      NRevPAR: 0, // Calculated in detailed views
      GOPPAR: 0, // Calculated in detailed views
      roomCount,
      confidence: totalNights > 0 ? 'high' : 'low'
    };
  }

  /**
   * 2. Cost Analysis (CPOR & Breakdown)
   */
  getCostBreakdown(totalNights: number) {
    const fixedMonthly = (this.costSettings?.fixed_costs?.salaries || 0) + 
                         (this.costSettings?.fixed_costs?.rent || 0) + 
                         (this.costSettings?.fixed_costs?.utilities || 0) + 
                         (this.costSettings?.fixed_costs?.other || 0);
    
    const fixedPerDay = fixedMonthly / 30.44;
    const periodFixed = fixedPerDay * this.period.days;
    
    const { perNightTotal: variablePerNight } = getVariableCostPerNight(
      this.costSettings,
      totalNights,
      this.reservations.length
    );

    return {
      periodFixed,
      fixedPerDay,
      variablePerNight,
      totalVariable: variablePerNight * totalNights,
      totalFixed: periodFixed
    };
  }

  /**
   * 3. Profitability (The "Net Profit" Source of Truth)
   */
  getProfitability() {
    const totalRevenue = this.reservations.reduce((sum, r) => sum + (r.room_revenue_total || 0), 0);
    const totalNights = this.reservations.reduce((sum, r) => sum + (r.room_nights || 0), 0);
    const costs = this.getCostBreakdown(totalNights);
    
    // Calculate commissions
    const defaultRate = this.costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = this.costSettings?.channel_commissions?.byChannel || {};
    
    const totalCommissions = this.reservations.reduce((sum, r) => {
      const source = r.source?.toLowerCase() || 'directo';
      const isDirect = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'].includes(source);
      if (isDirect) return sum;
      const rate = overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate;
      return sum + (r.room_revenue_total * rate);
    }, 0);

    const netProfit = totalRevenue - costs.totalFixed - costs.totalVariable - totalCommissions;
    
    logger.debug('ENGINE', 'Profitability calculation', {
      totalRevenue,
      totalCosts: costs.totalFixed + costs.totalVariable + totalCommissions,
      netProfit,
      margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    });

    return {
      totalRevenue,
      totalNights,
      totalCommissions,
      totalCosts: costs.totalFixed + costs.totalVariable + totalCommissions,
      netProfit,
      profitPerNight: totalNights > 0 ? netProfit / totalNights : 0,
      marginPercent: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    };
  }

  /**
   * Calculate detailed economics for a single reservation
   */
  calculateReservationEconomics(r: any) {
    const roomNights = r.room_nights || 0;
    const revenue = r.room_revenue_total || 0;
    
    // 1. Commissions
    const source = r.source?.toLowerCase() || 'directo';
    const isDirect = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone', 'directo'].includes(source);
    
    const defaultRate = this.costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = this.costSettings?.channel_commissions?.byChannel || {};
    const rate = isDirect ? 0 : (overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate);
    const commission = revenue * rate;
    
    // 2. Variable Costs
    const { perNightTotal: varPerNight } = getVariableCostPerNight(
      this.costSettings,
      roomNights,
      1
    );
    const variableCosts = varPerNight * roomNights;
    
    // 3. Fixed Costs (Allocated)
    const fixedMonthly = (this.costSettings?.fixed_costs?.salaries || 0) + 
                         (this.costSettings?.fixed_costs?.rent || 0) + 
                         (this.costSettings?.fixed_costs?.utilities || 0) + 
                         (this.costSettings?.fixed_costs?.other || 0);
    const fixedPerDay = fixedMonthly / 30.44;
    const roomCount = this.costSettings?.room_count || 1;
    const fixedAllocated = (fixedPerDay / roomCount) * roomNights;
    
    // 4. Net Profit
    const totalCosts = commission + variableCosts + fixedAllocated;
    const netProfit = revenue - totalCosts;
    
    return {
      reservationNumber: r.reservation_number,
      guestName: r.guest_name,
      source: r.source,
      sourceCategory: r.source_category,
      roomNights,
      revenue,
      commission,
      commissionRate: rate,
      variableCosts,
      fixedAllocated,
      totalCosts,
      netProfit,
      profitPerNight: roomNights > 0 ? netProfit / roomNights : 0,
      profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      isUnprofitable: netProfit < 0
    };
  }

  /**
   * Get Reservation Economics List
   */
  getReservationEconomicsList(filters?: any) {
    const economics = this.reservations.map((r: any) => {
      const econ = this.calculateReservationEconomics(r);
      return {
        ...econ,
        fixedAllocated: Math.round(econ.fixedAllocated || 0),
        variableCosts: Math.round(econ.variableCosts || 0),
        totalCosts: Math.round(econ.totalCosts || 0),
        netProfit: Math.round(econ.netProfit || 0),
        profitPerNight: Math.round(econ.profitPerNight || 0),
        profitMargin: Math.round(econ.profitMargin || 0),
        trust: 'real',
        confidence: 'high'
      };
    });

    let filtered = economics;
    if (filters?.source) {
      filtered = filtered.filter(e => e.source === filters.source);
    }
    if (filters?.unprofitableOnly) {
      filtered = filtered.filter(e => e.netProfit < 0);
    }

    return filtered;
  }

  /**
   * Get Cash Metrics
   */
  async getCashMetrics(): Promise<any> {
    const startingBalance = this.costSettings?.starting_cash_balance || 0;
    
    // Daily flow calculation
    const byDate: Record<string, { credits: number; debits: number }> = {};
    for (const t of this.transactions) {
      const date = t.txn_at.substring(0, 10);
      if (!byDate[date]) byDate[date] = { credits: 0, debits: 0 };
      byDate[date].credits += Number(t.credits) || 0;
      byDate[date].debits += Number(t.debits) || 0;
    }
    
    const dailyFlow = Object.entries(byDate)
      .map(([date, { credits, debits }]) => ({
        date,
        credits,
        debits,
        netFlow: credits - debits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let avgNetDaily = 0;
    if (dailyFlow.length > 0) {
      const totalNet = dailyFlow.reduce((sum, d) => sum + d.netFlow, 0);
      avgNetDaily = totalNet / dailyFlow.length;
    }
    
    let runwayDays = 0;
    let trust: TrustLevel = 'estimado';
    
    if (startingBalance === 0) {
      trust = 'incompleto';
    } else if (avgNetDaily < 0) {
      runwayDays = Math.floor(startingBalance / Math.abs(avgNetDaily));
    }
    
    return {
      period: this.getEffectivePeriod(),
      runway: {
        days: runwayDays,
        trust,
        startingBalance,
        avgNetDaily,
      },
      dailyFlow,
      alerts: [], // Could be populated from transactions
    };
  }

  /**
   * Get Channel Metrics
   */
  getChannelMetrics(): ChannelMetrics {
    const totalRevenue = this.reservations.reduce((sum, r) => sum + (Number(r.room_revenue_total) || 0), 0);
    const channelMap = new Map<string, any>();
    
    const defaultRate = this.costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = this.costSettings?.channel_commissions?.byChannel || {};

    for (const r of this.reservations) {
      const source = r.source || 'Directo';
      if (!channelMap.has(source)) {
        channelMap.set(source, {
          source: source,
          sourceCategory: r.source_category || 'Otro',
          revenue: 0,
          roomNights: 0,
        });
      }
      const ch = channelMap.get(source)!;
      ch.revenue += (Number(r.room_revenue_total) || 0);
      ch.roomNights += (Number(r.room_nights) || 0);
    }

    const channels = Array.from(channelMap.values()).map(ch => {
      const sourceLower = ch.source.toLowerCase();
      const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(sourceLower);
      const rate = isDirect ? 0 : (overrides[sourceLower] || DEFAULT_CHANNEL_COMMISSIONS[sourceLower] || defaultRate);
      
      const commission = ch.revenue * rate;
      const adr = ch.roomNights > 0 ? ch.revenue / ch.roomNights : 0;
      
      return {
        ...ch,
        revenueShare: totalRevenue > 0 ? ch.revenue / totalRevenue : 0,
        estimatedCommission: Math.round(commission),
        effectiveCommissionRate: rate,
        isCommissionEstimated: true,
        adr: Math.round(adr),
        adrNet: Math.round(adr * (1 - rate)),
        realCostPercent: Math.round(rate * 100 * 10) / 10,
      };
    });

    // Calcular insights de canales
    const directChannel = channels.find(c => ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(c.source.toLowerCase()));
    const directAdr = directChannel?.adr || (channels.length > 0 ? Math.max(...channels.map(c => c.adr)) : 0);

    const sortedByNet = [...channels].sort((a, b) => b.adrNet - a.adrNet);
    const bestChannel = sortedByNet[0] || null;
    const worstChannel = sortedByNet[sortedByNet.length - 1] || null;

    const otaRevenue = channels
      .filter(c => !['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(c.source.toLowerCase()))
      .reduce((sum, c) => sum + c.revenue, 0);
    
    const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;

    return {
      period: this.getEffectivePeriod(),
      channels,
      dependency: {
        topChannelCategory: 'OTA',
        sharePercent: Math.round(otaShare),
        isHighDependency: otaShare > 70,
      },
      savingsPotential: {
        value: Math.round(otaRevenue * 0.1 * 0.15), // Estimación simple: 10% de OTA a Directo ahorra 15%
        description: 'Si movés 10% de OTAs a Directo',
        trust: 'estimado',
      },
      insights: {
        bestChannel: bestChannel ? { name: bestChannel.source, adrNet: bestChannel.adrNet } : null,
        worstChannel: worstChannel ? { name: worstChannel.source, adrNet: worstChannel.adrNet } : null,
        directAdr: Math.round(directAdr),
      },
      dataSource: 'reservations',
    };
  }

  /**
   * Get Reservation Economics Summary
   */
  getReservationEconomicsSummary(filters?: any) {
    const economics = this.getReservationEconomicsList(filters);
    
    if (economics.length === 0) {
      return {
        totalReservations: 0,
        totalRoomNights: 0,
        totalRevenue: 0,
        totalCommissions: 0,
        totalVariableCosts: 0,
        totalFixedCostsAllocated: 0,
        totalNetProfit: 0,
        avgMarginPercent: 0,
        avgProfitPerNight: 0,
        goppar: 0,
        unprofitableCount: 0,
        unprofitableLoss: 0,
        unprofitableShare: 0,
        patterns: [],
        worstReservations: [],
        bestReservations: [],
        lowConfidenceCount: 0,
        lowConfidenceShare: 0,
        configUsed: {
          variableCostPerNight: 0,
          cleaningCostPerStay: 0,
          monthlyFixedCosts: 0,
          defaultCommissionRate: this.costSettings?.channel_commissions?.defaultRate || 0
        }
      };
    }

    const totalProfit = economics.reduce((sum, r) => sum + (r.netProfit || 0), 0);
    const totalRevenue = economics.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const totalNights = economics.reduce((sum, r) => sum + (r.roomNights || 0), 0);
    const totalCommissions = economics.reduce((sum, r) => sum + (r.commission || 0), 0);
    const totalVariableCosts = economics.reduce((sum, r) => sum + (r.variableCosts || 0), 0);
    const totalFixedCostsAllocated = economics.reduce((sum, r) => sum + (r.fixedAllocated || 0), 0);
    const unprofitable = economics.filter(r => r.netProfit < 0);
    const profitability = this.getProfitability();

    // Generar patrones para la vista de Profitability
    const patternsMap = new Map<string, any>();
    for (const econ of economics) {
      const nightsBucket = econ.roomNights === 1 ? '1' : econ.roomNights === 2 ? '2' : '3+';
      const key = `${econ.source}|${nightsBucket}`;
      
      if (!patternsMap.has(key)) {
        patternsMap.set(key, {
          source: econ.source,
          nightsBucket,
          count: 0,
          totalRevenue: 0,
          totalProfit: 0,
          isLossPattern: false,
          lossAmount: 0
        });
      }
      
      const p = patternsMap.get(key);
      p.count++;
      p.totalRevenue += econ.revenue;
      p.totalProfit += econ.netProfit;
    }

    const patterns = Array.from(patternsMap.values()).map(p => ({
      ...p,
      avgProfitPerNight: p.count > 0 ? p.totalProfit / (p.count * (p.nightsBucket === '3+' ? 3 : Number(p.nightsBucket))) : 0,
      isLossPattern: p.totalProfit < 0,
      lossAmount: p.totalProfit < 0 ? Math.abs(p.totalProfit) : 0
    })).sort((a, b) => a.totalProfit - b.totalProfit);

    return {
      totalReservations: economics.length,
      totalRoomNights: totalNights,
      totalRevenue,
      totalCommissions,
      totalVariableCosts,
      totalFixedCostsAllocated,
      totalNetProfit: totalProfit,
      avgMarginPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      avgProfitPerNight: totalNights > 0 ? totalProfit / totalNights : 0,
      unprofitableCount: unprofitable.length,
      unprofitableShare: (unprofitable.length / economics.length) * 100,
      unprofitableLoss: Math.abs(unprofitable.reduce((sum, r) => sum + (r.netProfit || 0), 0)),
      goppar: (profitability.netProfit || 0) / (economics.length || 1),
      patterns, 
      worstReservations: [...economics].sort((a, b) => (a.netProfit || 0) - (b.netProfit || 0)).slice(0, 10),
      bestReservations: [...economics].sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0)).slice(0, 10),
      lowConfidenceCount: 0,
      lowConfidenceShare: 0,
      configUsed: {
        variableCostPerNight: totalNights > 0 ? Math.round((profitability.totalCosts || 0) / totalNights) : 0,
        cleaningCostPerStay: this.costSettings?.variable_costs?.cleaningPerStay || 0,
        monthlyFixedCosts: (this.costSettings?.fixed_costs?.salaries || 0) + 
                           (this.costSettings?.fixed_costs?.rent || 0) + 
                           (this.costSettings?.fixed_costs?.utilities || 0) + 
                           (this.costSettings?.fixed_costs?.other || 0),
        defaultCommissionRate: this.costSettings?.channel_commissions?.defaultRate || 0
      }
    };
  }
}

