import database from '../db';
import { getVariableCostPerNight } from './costs-utils';
import logger from './logger';
import { 
  DatePeriod, 
  StructureMetrics, 
  ReservationEconomicsSummary,
  ChannelMetrics,
  DEFAULT_CHANNEL_COMMISSIONS
} from '../types';

/**
 * Single Source of Truth for Financial Calculations
 * Centralizes logic to ensure consistency across Home, CommandCenter, and Profitability views.
 */
export class CalculationEngine {
  private propertyId: string;
  private period: DatePeriod;
  private costSettings: any;
  private reservations: any[] = [];
  
  constructor(propertyId: string, period: DatePeriod) {
    this.propertyId = propertyId;
    this.period = period;
  }

  /**
   * Initialize engine with data
   */
  async init() {
    logger.debug('ENGINE', `Initializing for period: ${this.period.start} to ${this.period.end}`);
    const [settings, allReservations] = await Promise.all([
      database.getCostSettings(this.propertyId),
      database.getReservationsByProperty(this.propertyId)
    ]);
    
    this.costSettings = settings;
    this.reservations = allReservations.filter((r: any) => {
      if (r.status === 'Cancelled' || r.status === 'No Show') return false;
      const checkIn = r.check_in?.substring(0, 10);
      return checkIn >= this.period.start && checkIn <= this.period.end;
    });

    logger.info('ENGINE', `Initialized with ${this.reservations.length} active reservations in period.`);
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
    const availableNights = roomCount * this.period.days;
    
    const occupancyRate = availableNights > 0 ? (totalNights / availableNights) * 100 : 0;
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
    
    return {
      period: this.period,
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
   * 4. Unit Economics per Reservation
   */
  calculateReservationEconomics(r: any) {
    const totalNights = this.reservations.reduce((sum, res) => sum + (res.room_nights || 0), 0);
    const { perNightTotal: variablePerNight } = getVariableCostPerNight(
      this.costSettings,
      r.room_nights,
      1
    );

    const fixedMonthly = (this.costSettings?.fixed_costs?.salaries || 0) + 
                         (this.costSettings?.fixed_costs?.rent || 0) + 
                         (this.costSettings?.fixed_costs?.utilities || 0) + 
                         (this.costSettings?.fixed_costs?.other || 0);
    
    const fixedPerDay = fixedMonthly / 30.44;
    const roomCount = this.costSettings?.room_count || 1;
    const fixedAllocated = (fixedPerDay / roomCount) * r.room_nights;

    const source = r.source?.toLowerCase() || 'directo';
    const isDirect = ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(source);
    
    const defaultRate = this.costSettings?.channel_commissions?.defaultRate || 0;
    const overrides = this.costSettings?.channel_commissions?.byChannel || {};
    const commissionRate = isDirect ? 0 : (overrides[source] || DEFAULT_CHANNEL_COMMISSIONS[source] || defaultRate);
    
    const commission = r.room_revenue_total * commissionRate;
    const totalCosts = commission + fixedAllocated + (variablePerNight * r.room_nights);
    const netProfit = r.room_revenue_total - totalCosts;

    return {
      reservationNumber: r.reservation_number,
      guestName: r.guest_name,
      checkIn: r.check_in,
      source: r.source,
      sourceCategory: r.source_category,
      roomNights: r.room_nights,
      revenue: r.room_revenue_total,
      commission,
      commissionRate,
      fixedAllocated,
      variableCosts: variablePerNight * r.room_nights,
      totalCosts,
      netProfit,
      profitPerNight: r.room_nights > 0 ? netProfit / r.room_nights : 0,
      profitMargin: r.room_revenue_total > 0 ? (netProfit / r.room_revenue_total) * 100 : 0,
      isUnprofitable: netProfit < 0
    };
  }
}

