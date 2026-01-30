import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { 
  ProjectionsData, 
  PacingPeriod, 
  GapAlert, 
  DatePeriod,
  AlertSeverity
} from '../types';
import logger from './logger';

/**
 * Projections Service - On-The-Books (OTB) and Pacing Analysis
 */
export class ProjectionsService {
  private propertyId: string;
  private horizon: number;

  constructor(propertyId: string, horizon: number = 90) {
    this.propertyId = propertyId;
    this.horizon = horizon;
  }

  /**
   * Get all projection data including OTB, Pacing and Gaps
   */
  async getProjections(): Promise<ProjectionsData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const horizonEnd = new Date(today.getTime() + this.horizon * 24 * 60 * 60 * 1000);
    
    // 1. Initialize Engine for future period
    const futurePeriod: DatePeriod = {
      start: today.toISOString().substring(0, 10),
      end: horizonEnd.toISOString().substring(0, 10),
      days: this.horizon
    };
    
    const engine = new CalculationEngine(this.propertyId, futurePeriod);
    await engine.init();
    
    const costSettings = await database.getCostSettings(this.propertyId);
    const roomCount = costSettings?.room_count || 1;
    const allReservations = await database.getAllReservations(this.propertyId);
    const activeReservations = allReservations.filter((r: any) => 
      r.status !== 'Cancelled' && r.status !== 'No Show'
    );

    // 2. Calculate OTB Summary
    const summary = this.calculateOTBSummary(activeReservations, today, horizonEnd);

    // 3. Calculate Pacing (Weekly)
    const pacingPeriods = await this.calculatePacing(activeReservations, today, this.horizon, roomCount);

    // 4. Calculate Daily Metrics for Calendar (including past 30 days for context)
    const dailyMetrics = this.calculateDailyMetrics(activeReservations, today, this.horizon, roomCount);

    // 5. Detect Gaps
    const gaps = this.detectGaps(pacingPeriods);

    // 6. Calculate Weekly Cash Flow
    const cashFlow = this.calculateWeeklyCashFlow(activeReservations, today, this.horizon);

    // 7. Overall Trend
    const deltaVsLastYear = pacingPeriods.reduce((sum, p) => sum + (p.current.occupancy - p.historical.occupancy), 0) / (pacingPeriods.length || 1);
    const overallTrend = deltaVsLastYear > 2 ? 'ahead' : deltaVsLastYear < -2 ? 'behind' : 'on_track';

    return {
      horizon: this.horizon,
      summary,
      pacing: {
        periods: pacingPeriods,
        overallTrend,
        deltaVsLastYear: Math.round(deltaVsLastYear * 10) / 10
      },
      daily: dailyMetrics,
      gaps,
      cashFlow
    };
  }

  private calculateDailyMetrics(reservations: any[], today: Date, horizon: number, roomCount: number) {
    const daily: any[] = [];
    
    // Start from 30 days ago to show historical context in the calendar
    const startOffset = -30;
    
    for (let d = startOffset; d < horizon; d++) {
      const dayStart = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayPeriod: DatePeriod = {
        start: dayStart.toISOString().substring(0, 10),
        end: dayEnd.toISOString().substring(0, 10),
        days: 1
      };

      // For past dates, we use today as the asOfDate to see final results
      // For future dates, we also use today as asOfDate to see OTB
      const metrics = this.getMetricsForPeriod(reservations, dayPeriod, today, roomCount);
      
      daily.push({
        date: dayPeriod.start,
        ...metrics,
        isPast: d < 0
      });
    }

    return daily;
  }

  private calculateOTBSummary(reservations: any[], today: Date, horizonEnd: Date) {
    const todayStr = today.toISOString().substring(0, 10);
    const endStr = horizonEnd.toISOString().substring(0, 10);
    
    const futureRes = reservations.filter(r => {
      const checkIn = r.check_in?.substring(0, 10);
      const checkOut = r.check_out?.substring(0, 10);
      return checkIn <= endStr && checkOut > todayStr;
    });

    let revenueOTB = 0;
    let occupiedNights = 0;
    let pendingCollections = 0;

    futureRes.forEach(r => {
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      const actualStart = checkIn > today ? checkIn : today;
      const actualEnd = checkOut < horizonEnd ? checkOut : horizonEnd;
      
      const nightsInPeriod = Math.max(0, Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (24 * 60 * 60 * 1000)));
      const totalNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
      const ratio = nightsInPeriod / totalNights;
      
      revenueOTB += (Number(r.room_revenue_total) || 0) * ratio;
      occupiedNights += nightsInPeriod;
      pendingCollections += (Number(r.balance_due) || 0) * ratio;
    });

    // Pickup last 7 days
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pickupRes = reservations.filter(r => {
      const bookingDate = r.reservation_date ? new Date(r.reservation_date) : null;
      const checkIn = r.check_in?.substring(0, 10);
      return bookingDate && bookingDate >= sevenDaysAgo && checkIn >= todayStr;
    });

    return {
      revenueOTB: Math.round(revenueOTB),
      occupancyOTB: Math.round((occupiedNights / (this.horizon * (reservations[0]?.room_count || 10))) * 1000) / 10, // Fallback room count
      pendingCollections: Math.round(pendingCollections),
      pickupLast7Days: {
        reservations: pickupRes.length,
        revenue: Math.round(pickupRes.reduce((sum, r) => sum + (Number(r.room_revenue_total) || 0), 0))
      }
    };
  }

  private async calculatePacing(reservations: any[], today: Date, horizon: number, roomCount: number): Promise<PacingPeriod[]> {
    const periods: PacingPeriod[] = [];
    const weeksCount = Math.ceil(horizon / 7);

    for (let w = 0; w < weeksCount; w++) {
      const weekStart = new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weekPeriod: DatePeriod = {
        start: weekStart.toISOString().substring(0, 10),
        end: weekEnd.toISOString().substring(0, 10),
        days: 7
      };

      // 1. Current OTB for this week
      const currentMetrics = this.getMetricsForPeriod(reservations, weekPeriod, today, roomCount);

      // 2. Historical OTB for same week last year, AS OF same DBA
      const lyWeekStart = new Date(weekStart);
      lyWeekStart.setFullYear(weekStart.getFullYear() - 1);
      const lyWeekEnd = new Date(weekEnd);
      lyWeekEnd.setFullYear(weekEnd.getFullYear() - 1);
      
      const lyWeekPeriod: DatePeriod = {
        start: lyWeekStart.toISOString().substring(0, 10),
        end: lyWeekEnd.toISOString().substring(0, 10),
        days: 7
      };

      const lyAsOfDate = new Date(today);
      lyAsOfDate.setFullYear(today.getFullYear() - 1);

      const historicalMetrics = this.getMetricsForPeriod(reservations, lyWeekPeriod, lyAsOfDate, roomCount);

      periods.push({
        label: `Semana ${w + 1}`,
        startDate: weekPeriod.start,
        endDate: weekPeriod.end,
        current: currentMetrics,
        historical: historicalMetrics,
        deltaOccupancy: Math.round((currentMetrics.occupancy - historicalMetrics.occupancy) * 10) / 10,
        deltaRevenue: Math.round((currentMetrics.revenue - historicalMetrics.revenue))
      });
    }

    return periods;
  }

  private getMetricsForPeriod(reservations: any[], period: DatePeriod, asOfDate: Date, roomCount: number) {
    const periodRes = reservations.filter(r => {
      const bookingDate = r.reservation_date ? new Date(r.reservation_date) : null;
      if (!bookingDate || bookingDate > asOfDate) return false;
      
      const checkIn = r.check_in?.substring(0, 10);
      const checkOut = r.check_out?.substring(0, 10);
      return checkIn <= period.end && checkOut > period.start;
    });

    let revenue = 0;
    let nights = 0;
    const pStart = new Date(period.start);
    const pEnd = new Date(period.end);

    periodRes.forEach(r => {
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      const actualStart = checkIn > pStart ? checkIn : pStart;
      const actualEnd = checkOut < pEnd ? checkOut : pEnd;
      
      const nightsInPeriod = Math.max(0, Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (24 * 60 * 60 * 1000)));
      const totalNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
      const ratio = nightsInPeriod / totalNights;
      
      revenue += (Number(r.room_revenue_total) || 0) * ratio;
      nights += nightsInPeriod;
    });

    const occupancy = (nights / (period.days * roomCount)) * 100;
    const adr = nights > 0 ? revenue / nights : 0;

    return {
      revenue: Math.round(revenue),
      occupancy: Math.round(occupancy * 10) / 10,
      adr: Math.round(adr),
      nights: Math.round(nights)
    };
  }

  private detectGaps(pacingPeriods: PacingPeriod[]): GapAlert[] {
    const gaps: GapAlert[] = [];
    
    pacingPeriods.forEach((p, index) => {
      // Si la ocupacion es < 20% Y estamos por debajo del ritmo del ano pasado por mas de 5 puntos
      if (p.current.occupancy < 20 && p.deltaOccupancy < -5) {
        gaps.push({
          id: `gap-low-occ-${index}`,
          weekStart: p.startDate,
          title: `Baja ocupación detectada`,
          description: `La semana del ${new Date(p.startDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} viene un ${Math.abs(p.deltaOccupancy)}% más lenta que el año pasado.`,
          severity: 'warning',
          currentOccupancy: p.current.occupancy,
          historicalOccupancy: p.historical.occupancy,
          actionLabel: 'Ver sugerencias',
          actionType: 'visibility_boost'
        });
      }
      
      // Si el ADR es significativamente mas bajo que el ano pasado
      if (p.current.occupancy > 30 && p.current.adr < p.historical.adr * 0.9) {
        gaps.push({
          id: `gap-low-adr-${index}`,
          weekStart: p.startDate,
          title: `ADR por debajo del histórico`,
          description: `Estás vendiendo un 10% más barato que el año pasado para una ocupación similar.`,
          severity: 'info',
          currentOccupancy: p.current.occupancy,
          historicalOccupancy: p.historical.occupancy,
          actionLabel: 'Ajustar precios',
          actionType: 'price_adjustment'
        });
      }
    });

    return gaps;
  }

  private calculateWeeklyCashFlow(reservations: any[], today: Date, horizon: number) {
    const byWeek: { weekStart: string; expected: number; alreadyPaid: number; pending: number }[] = [];
    const weeksCount = Math.ceil(horizon / 7);

    for (let w = 0; w < weeksCount; w++) {
      const weekStart = new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const weekStartStr = weekStart.toISOString().substring(0, 10);
      const weekEndStr = weekEnd.toISOString().substring(0, 10);

      const weekRes = reservations.filter(r => {
        const checkIn = r.check_in?.substring(0, 10);
        return checkIn >= weekStartStr && checkIn <= weekEndStr;
      });

      const expected = weekRes.reduce((sum, r) => sum + (Number(r.room_revenue_total) || 0), 0);
      const alreadyPaid = weekRes.reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);
      const pending = expected - alreadyPaid;

      byWeek.push({
        weekStart: weekStartStr,
        expected: Math.round(expected),
        alreadyPaid: Math.round(alreadyPaid),
        pending: Math.round(pending)
      });
    }

    return { byWeek };
  }
}

