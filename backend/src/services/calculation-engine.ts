import database from '../db';
import { getVariableCostPerNight } from './costs-utils';
import logger from './logger';
import { 
  DatePeriod, 
  StructureMetrics, 
  ReservationEconomicsSummary,
  ChannelMetrics,
  DEFAULT_CHANNEL_COMMISSIONS,
  DEFAULT_TAX_RULES,
  DAYS_PER_MONTH,
  isExcludedStatus,
  DEFAULT_ROOM_COUNT,
  HomeMetrics,
  TrustLevel
} from '../types';
import { isDirectChannel } from './metrics-core';

/**
 * Single Source of Truth for Financial Calculations
 * Centralizes logic to ensure consistency across Home, CommandCenter, and Profitability views.
 * 
 * IMPORTANTE: Este engine detecta automáticamente el rango de datos disponibles.
 * Si el período solicitado no tiene datos pero existen datos históricos,
 * el engine ajustará el período para mostrar los datos disponibles (a menos que se deshabilite).
 */

export interface CalculationEngineOptions {
  /** Si es true, no hace fallback a datos históricos cuando no hay datos en el período */
  disableFallback?: boolean;
  /** Pre-loaded reservations to avoid redundant DB queries */
  preloadedReservations?: any[];
  /** Pre-loaded cost settings */
  preloadedCostSettings?: any;
  /** Pre-loaded import files */
  preloadedImportFiles?: any[];
}

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
  private options: CalculationEngineOptions;
  
  constructor(propertyId: string, period: DatePeriod, options: CalculationEngineOptions = {}) {
    this.propertyId = propertyId;
    this.period = period;
    this.originalPeriod = { ...period };
    this.options = options;
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
    
    // 1. Use pre-loaded data if available, otherwise fetch from DB
    if (this.options.preloadedCostSettings !== undefined && this.options.preloadedImportFiles !== undefined) {
      this.costSettings = this.options.preloadedCostSettings;
      this.importFiles = this.options.preloadedImportFiles || [];
    } else {
      const [settings, importFiles] = await Promise.all([
        database.getCostSettings(this.propertyId),
        database.getImportFiles(this.propertyId)
      ]);
      this.costSettings = settings;
      this.importFiles = importFiles;
    }
    
    // 2. Use pre-loaded reservations or fetch from DB
    const allReservations = this.options.preloadedReservations ?? await database.getAllReservations(this.propertyId);
    
    this.allReservations = allReservations.filter((r: any) => !isExcludedStatus(r.status));
    
    // 3. Filtrar reservaciones por período original
    let filteredReservations = this.filterReservationsByPeriod(allReservations, this.period);
    
    // 4. AUTO-DETECCIÓN: Si no hay datos en el período actual, buscar datos históricos
    // NOTA: Si disableFallback está activo, NO hacemos fallback a datos históricos.
    // Esto es importante para el actions-service donde queremos analizar SOLO el período seleccionado.
    if (filteredReservations.length === 0 && allReservations.length > 0 && !this.options.disableFallback) {
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
    } else if (filteredReservations.length === 0 && this.options.disableFallback) {
      logger.info('ENGINE', `No data in requested period and fallback disabled. Using empty dataset.`);
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
      if (isExcludedStatus(r.status)) return false;
      const checkIn = r.check_in?.substring(0, 10);
      const checkOut = r.check_out?.substring(0, 10);
      
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
    const roomCount = this.costSettings?.room_count || DEFAULT_ROOM_COUNT;
    const totalPossibleNights = roomCount * requestedDays;
    const projectedOccupancy = totalPossibleNights > 0 ? occupiedNights / totalPossibleNights : 0;

    // 4. Booking Window (Anticipación) - usar reservation_date del CSV de Cloudbeds
    let totalLeadTime = 0;
    let leadTimeCount = 0;
    
    this.allReservations.forEach(r => {
      const bookingDate = r.reservation_date;
      if (bookingDate && r.check_in) {
        const resDateStr = typeof bookingDate === 'string' ? bookingDate.substring(0, 10) : '';
        const checkInStr = typeof r.check_in === 'string' ? r.check_in.substring(0, 10) : '';
        
        if (resDateStr && checkInStr) {
          const resDate = new Date(resDateStr + 'T00:00:00Z');
          const checkIn = new Date(checkInStr + 'T00:00:00Z');
          const diff = Math.round((checkIn.getTime() - resDate.getTime()) / msPerDay);
          // Solo contar si check_in es posterior a la fecha de reserva y es razonable (<365 días)
          if (diff >= 0 && diff < 365) {
            totalLeadTime += diff;
            leadTimeCount++;
          }
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
    
    const roundedOccupancy = Math.round(Math.min(100, occupancyRate) * 10) / 10;

    const profitability = this.getProfitability();
    const totalCommissions = profitability.totalCommissions || 0;
    const netProfit = profitability.netProfit || 0;
    const nRevPAR = availableNights > 0 ? Math.round((totalRevenue - totalCommissions) / availableNights) : 0;
    const goppar = availableNights > 0 ? Math.round(netProfit / availableNights) : 0;

    return {
      period: effectivePeriod,
      occupancyRate: roundedOccupancy,
      ADR: Math.round(adr),
      RevPAR: availableNights > 0 ? Math.round(totalRevenue / availableNights) : 0,
      NRevPAR: nRevPAR,
      GOPPAR: goppar,
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
    
    const fixedPerDay = fixedMonthly / DAYS_PER_MONTH;
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
      const isDirect = isDirectChannel(r.source, r.source_category);
      if (isDirect) return sum;
      const rate = overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate;
      return sum + (r.room_revenue_total * rate);
    }, 0);

    // Calculate Taxes
    const taxRules = (this.costSettings?.tax_rules?.length > 0) ? this.costSettings.tax_rules : DEFAULT_TAX_RULES;
    let totalTaxes = 0;
    
    this.reservations.forEach(r => {
      const roomRevenue = r.room_revenue_total || 0;
      const nights = r.room_nights || 0;
      
      taxRules.forEach((rule: any) => {
        let taxAmount = 0;
        if (rule.method === 'percentage') {
          const base = rule.appliesTo === 'room_rate' ? roomRevenue : roomRevenue;
          taxAmount = base * (rule.value / 100);
        } else if (rule.method === 'fixed_per_night') {
          taxAmount = rule.value * nights;
        } else if (rule.method === 'fixed_per_stay') {
          taxAmount = rule.value;
        }
        
        if (rule.includedInRate) {
          totalTaxes += taxAmount;
        }
      });
    });

    const netProfit = totalRevenue - costs.totalFixed - costs.totalVariable - totalCommissions - totalTaxes;
    
    logger.debug('ENGINE', 'Profitability calculation', {
      totalRevenue,
      totalCosts: costs.totalFixed + costs.totalVariable + totalCommissions + totalTaxes,
      netProfit,
      margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    });

    return {
      totalRevenue,
      totalNights,
      totalCommissions,
      totalTaxes,
      totalCosts: costs.totalFixed + costs.totalVariable + totalCommissions + totalTaxes,
      netProfit,
      profitPerNight: totalNights > 0 ? netProfit / totalNights : 0,
      marginPercent: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    };
  }

  /**
   * Calculate detailed economics for a single reservation
   * 
   * IMPORTANTE: Los costos variables mensuales (lavandería, amenities) se dividen por
   * 30.44 (días promedio por mes) para obtener un costo por noche consistente.
   * La limpieza por estadía se calcula por separado usando la estadía real de la reserva.
   */
  calculateReservationEconomics(r: any) {
    const roomNights = r.room_nights || 0;
    const revenue = r.room_revenue_total || 0;
    
    // 1. Commissions
    const source = r.source?.toLowerCase() || 'directo';
    const isDirect = isDirectChannel(r.source, r.source_category);
    
    const defaultRate = this.costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = this.costSettings?.channel_commissions?.byChannel || {};
    const rate = isDirect ? 0 : (overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate);
    const commission = revenue * rate;
    
    // 2. Variable Costs
    // CORRECCIÓN: Los costos variables mensuales se dividen por el TOTAL de noches vendidas
    // en el período, NO por las noches de la reserva individual.
    // Esto asegura consistencia entre el cálculo agregado y el individual.
    // Si no hay noches vendidas, usamos capacidad mensual como fallback.
    const totalNightsSold = this.reservations.reduce((sum, res) => sum + (res.room_nights || 0), 0);
    const roomCount = this.costSettings?.room_count || DEFAULT_ROOM_COUNT;
    const monthlyCapacity = roomCount * DAYS_PER_MONTH;
    
    // Usar noches vendidas si hay datos, sino usar capacidad como base estable
    const divisorForMonthlyCosts = totalNightsSold > 0 ? totalNightsSold : monthlyCapacity;
    
    // Obtener costos base del sistema de categorías o legacy
    const usesCategories = Array.isArray(this.costSettings?.variable_categories) && this.costSettings.variable_categories.length > 0;
    const legacyCosts = this.costSettings?.variable_costs || {
      cleaningPerStay: 0,
      laundryMonthly: 0,
      amenitiesMonthly: 0,
    };
    
    // Costos mensuales (se dividen por total de noches para obtener costo/noche ocupada)
    const monthlyVariableTotal = usesCategories
      ? (this.costSettings.variable_categories || []).reduce(
          (sum: number, cat: any) => sum + (cat?.monthlyAmount || 0), 0
        )
      : (legacyCosts.laundryMonthly || 0) + (legacyCosts.amenitiesMonthly || 0);
    
    const variablePerNight = monthlyVariableTotal / divisorForMonthlyCosts;
    
    // Limpieza por estadía (se cobra UNA VEZ por reserva, no por noche)
    const cleaningPerStay = usesCategories ? 0 : (legacyCosts.cleaningPerStay || 0);
    
    // Costo variable total = (costo mensual prorrateado × noches) + limpieza por estadía
    const variableCosts = (variablePerNight * roomNights) + cleaningPerStay;
    
    // 3. Fixed Costs (Allocated)
    const fixedMonthly = (this.costSettings?.fixed_costs?.salaries || 0) + 
                         (this.costSettings?.fixed_costs?.rent || 0) + 
                         (this.costSettings?.fixed_costs?.utilities || 0) + 
                         (this.costSettings?.fixed_costs?.other || 0);
    const fixedPerDay = fixedMonthly / DAYS_PER_MONTH;
    const fixedAllocated = (fixedPerDay / roomCount) * roomNights;

    // 4. Taxes
    const taxRulesRes = (this.costSettings?.tax_rules?.length > 0) ? this.costSettings.tax_rules : DEFAULT_TAX_RULES;
    let taxes = 0;
    taxRulesRes.forEach((rule: any) => {
      let taxAmount = 0;
      if (rule.method === 'percentage') {
        taxAmount = revenue * (rule.value / 100);
      } else if (rule.method === 'fixed_per_night') {
        taxAmount = rule.value * roomNights;
      } else if (rule.method === 'fixed_per_stay') {
        taxAmount = rule.value;
      }
      
      if (rule.includedInRate) {
        taxes += taxAmount;
      }
    });
    
    // 5. Net Profit
    const totalCosts = commission + variableCosts + fixedAllocated + taxes;
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
      taxes,
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
          leadTimes: [] as number[],
          reservations: [] as any[],
        });
      }
      const ch = channelMap.get(source)!;
      ch.revenue += (Number(r.room_revenue_total) || 0);
      ch.roomNights += (Number(r.room_nights) || 0);
      
      // Lead Time calculation
      // Usamos reservation_date que ahora se extrae de "Booking Date Time - UTC" del CSV de Cloudbeds
      const bookingDate = r.reservation_date;
      
      if (bookingDate && r.check_in) {
        // Normalizar fechas a medianoche UTC para evitar problemas de zona horaria
        const resDateStr = typeof bookingDate === 'string' ? bookingDate.substring(0, 10) : '';
        const checkInStr = typeof r.check_in === 'string' ? r.check_in.substring(0, 10) : '';
        
        if (resDateStr && checkInStr) {
          const resDate = new Date(resDateStr + 'T00:00:00Z');
          const checkIn = new Date(checkInStr + 'T00:00:00Z');
          
          const diff = Math.round((checkIn.getTime() - resDate.getTime()) / (24 * 60 * 60 * 1000));
          // Permitir diff 0 (reservas mismo día) y filtrar outliers extremos
          if (diff >= 0 && diff < 730) {
            ch.leadTimes.push(diff);
          }
        }
      }
      ch.reservations.push(r);
    }

    // IMPORTANTE: Calcular costos usando noches TOTALES para obtener el costo por noche correcto
    // Luego prorratear a cada canal según su proporción de noches
    const totalNightsAllChannels = Array.from(channelMap.values()).reduce((sum, ch) => sum + ch.roomNights, 0);
    const globalCosts = this.getCostBreakdown(totalNightsAllChannels);
    const roomCount = this.costSettings?.room_count || DEFAULT_ROOM_COUNT;
    
    const channels = Array.from(channelMap.values()).map(ch => {
      const sourceLower = ch.source.toLowerCase();
      const isDirect = isDirectChannel(ch.source, ch.sourceCategory);
      const rate = isDirect ? 0 : (overrides[sourceLower] || DEFAULT_CHANNEL_COMMISSIONS[sourceLower] || defaultRate);
      
      const commission = ch.revenue * rate;
      const adr = ch.roomNights > 0 ? ch.revenue / ch.roomNights : 0;
      
      // Lead Time Median
      const sortedLeadTimes = [...ch.leadTimes].sort((a, b) => a - b);
      let medianLeadTime = 0;
      if (sortedLeadTimes.length > 0) {
        const mid = Math.floor(sortedLeadTimes.length / 2);
        medianLeadTime = sortedLeadTimes.length % 2 !== 0 
          ? sortedLeadTimes[mid] 
          : (sortedLeadTimes[mid - 1] + sortedLeadTimes[mid]) / 2;
      }

    // Calculate net profit for this channel
    // CORREGIDO: Usar el costo variable por noche global y prorratear al canal
    const channelVariableCost = globalCosts.variablePerNight * ch.roomNights;
    
    // Costos fijos prorrateados por proporción de noches vendidas
    const nightsShare = totalNightsAllChannels > 0 ? ch.roomNights / totalNightsAllChannels : 0;
    const channelFixedCost = globalCosts.periodFixed * nightsShare;
    
    // Calculate taxes for this channel
    const taxRulesCh = (this.costSettings?.tax_rules?.length > 0) ? this.costSettings.tax_rules : DEFAULT_TAX_RULES;
    let channelTaxes = 0;
    taxRulesCh.forEach((rule: any) => {
      if (rule.includedInRate) {
        if (rule.method === 'percentage') {
          channelTaxes += ch.revenue * (rule.value / 100);
        } else if (rule.method === 'fixed_per_night') {
          channelTaxes += rule.value * ch.roomNights;
        } else if (rule.method === 'fixed_per_stay') {
          // Aproximación: estimamos estadías de 3 noches si no tenemos el dato exacto por canal aquí
          const estimatedStays = ch.roomNights / 3;
          channelTaxes += rule.value * estimatedStays;
        }
      }
    });

    const netProfit = ch.revenue - commission - channelVariableCost - channelFixedCost - channelTaxes;

    const profitPerNight = ch.roomNights > 0 ? netProfit / ch.roomNights : 0;

    return {
      source: ch.source,
      sourceCategory: ch.sourceCategory,
      revenue: ch.revenue,
      roomNights: ch.roomNights,
      revenueShare: totalRevenue > 0 ? ch.revenue / totalRevenue : 0,
      estimatedCommission: Math.round(commission),
      effectiveCommissionRate: rate,
      isCommissionEstimated: true,
      adr: Math.round(adr),
      adrNet: Math.round(adr * (1 - rate)),
      realCostPercent: Math.round(rate * 100 * 10) / 10,
      netProfit: Math.round(netProfit),
      medianLeadTime: Math.round(medianLeadTime * 10) / 10,
      profitPerNight: Math.round(profitPerNight),
      _rawReservations: ch.reservations // Internal use for lead time analysis
    };
    });

    const totalNetProfit = channels.reduce((sum, c) => sum + c.netProfit, 0);

    const channelsWithProfitShare = channels.map(c => ({
      ...c,
      profitShare: totalNetProfit > 0 ? Math.max(0, c.netProfit) / totalNetProfit : 0
    }));

    // Lead Time Analysis
    const leadTimeBuckets = [
      { label: '0-3 días', min: 0, max: 3 },
      { label: '4-7 días', min: 4, max: 7 },
      { label: '8-14 días', min: 8, max: 14 },
      { label: '15-30 días', min: 15, max: 30 },
      { label: '31+ días', min: 31, max: 999 }
    ];

    const analyzeLeadTime = (resList: any[]) => {
      return leadTimeBuckets.map(bucket => {
        const bucketRes = resList.filter(r => {
          const bookingDate = r.reservation_date;
          if (!bookingDate || !r.check_in) return false;
          
          const resDateStr = typeof bookingDate === 'string' ? bookingDate.substring(0, 10) : '';
          const checkInStr = typeof r.check_in === 'string' ? r.check_in.substring(0, 10) : '';
          
          if (!resDateStr || !checkInStr) return false;
          
          const resDate = new Date(resDateStr + 'T00:00:00Z');
          const checkInDate = new Date(checkInStr + 'T00:00:00Z');
          
          const diff = Math.round((checkInDate.getTime() - resDate.getTime()) / (24 * 60 * 60 * 1000));
          return diff >= bucket.min && diff <= bucket.max;
        });

        let bucketRevenue = 0;
        let bucketNights = 0;
        let bucketProfit = 0;

        bucketRes.forEach(r => {
          const econ = this.calculateReservationEconomics(r);
          bucketRevenue += econ.revenue;
          bucketNights += econ.roomNights;
          bucketProfit += econ.netProfit;
        });

        return {
          leadTimeRange: bucket.label,
          avgProfitPerNight: bucketNights > 0 ? Math.round(bucketProfit / bucketNights) : 0,
          reservationCount: bucketRes.length,
          revenue: Math.round(bucketRevenue),
          profit: Math.round(bucketProfit)
        };
      });
    };

    const leadTimeByChannel: Record<string, any[]> = {};
    channelsWithProfitShare.forEach(c => {
      leadTimeByChannel[c.source] = analyzeLeadTime(c._rawReservations);
    });

    const globalLeadTimeProfitability = analyzeLeadTime(this.reservations);

    // Remove raw reservations before returning
    const finalChannels = channelsWithProfitShare.map(({ _rawReservations, ...rest }) => rest);

    // Calcular insights de canales
    const directChannel = finalChannels.find(c => isDirectChannel(c.source, c.sourceCategory));
    const directAdr = directChannel?.adr || (finalChannels.length > 0 ? Math.max(...finalChannels.map(c => c.adr)) : 0);
    const directNetProfitPerNight = directChannel?.profitPerNight || (finalChannels.length > 0 ? Math.max(...finalChannels.map(c => c.profitPerNight)) : 0);

    const sortedByNet = [...finalChannels].sort((a, b) => b.profitPerNight - a.profitPerNight);
    const bestChannel = sortedByNet[0] || null;
    const worstChannel = sortedByNet[sortedByNet.length - 1] || null;

    const otaRevenue = finalChannels
      .filter(c => !isDirectChannel(c.source, c.sourceCategory))
      .reduce((sum, c) => sum + c.revenue, 0);
    
    const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;

    // Potential savings: More accurate calculation
    // If we replace OTA revenue with Direct revenue, we save the commission but also gain/lose based on ADR difference
    const otaChannels = finalChannels.filter(c => !isDirectChannel(c.source, c.sourceCategory));
    let totalSavingsPotential = 0;
    
    otaChannels.forEach(ota => {
      const nightsToMove = ota.roomNights * 0.2; // Assume 20% can be moved to direct
      const currentProfit = ota.profitPerNight * nightsToMove;
      const potentialProfit = directNetProfitPerNight * nightsToMove;
      if (potentialProfit > currentProfit) {
        totalSavingsPotential += (potentialProfit - currentProfit);
      }
    });

    return {
      period: this.getEffectivePeriod(),
      channels: finalChannels as any[],
      dependency: {
        topChannelCategory: 'OTA',
        sharePercent: Math.round(otaShare),
        isHighDependency: otaShare > 70,
      },
      savingsPotential: {
        value: Math.round(totalSavingsPotential),
        description: 'Si movés el 20% de tus reservas de OTAs a Directo',
        trust: 'estimado',
      },
      insights: {
        bestChannel: bestChannel ? { name: bestChannel.source, adrNet: bestChannel.adrNet } : null,
        worstChannel: worstChannel ? { name: worstChannel.source, adrNet: worstChannel.adrNet } : null,
        directAdr: Math.round(directAdr),
        leadTimeAnalysis: {
          byChannel: leadTimeByChannel,
          globalLeadTimeProfitability
        }
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
    const totalTaxes = economics.reduce((sum, r) => sum + (r.taxes || 0), 0);
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
      totalTaxes,
      totalVariableCosts,
      totalFixedCostsAllocated,
      totalNetProfit: totalProfit,
      avgMarginPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      avgProfitPerNight: totalNights > 0 ? totalProfit / totalNights : 0,
      unprofitableCount: unprofitable.length,
      unprofitableShare: (unprofitable.length / (economics.length || 1)) * 100,
      unprofitableLoss: Math.abs(unprofitable.reduce((sum, r) => sum + (r.netProfit || 0), 0)),
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
