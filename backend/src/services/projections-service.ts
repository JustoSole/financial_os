import database from '../db';
import cacheService from './cache-service';
import { CalculationEngine } from './calculation-engine';
import { 
  ProjectionsData, 
  PacingPeriod, 
  GapAlert, 
  DatePeriod,
  AlertSeverity
} from '../types';
import logger from './logger';
import {
  aggregatePeriodMetrics,
  calculateOccupancyPercent,
  dateToIsoDay,
  getOverlappingNights,
  isExcludedReservationStatus,
  prorateReservationToPeriod,
} from './metrics-core';

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
    const cacheKey = `projections-${this.propertyId}-${this.horizon}`;
    const cached = cacheService.get<ProjectionsData>(cacheKey);
    if (cached) return cached;

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
    const summary = this.calculateOTBSummary(activeReservations, today, horizonEnd, roomCount);

    // 3. Calculate Pacing (Weekly)
    const pacing = await this.calculatePacing(activeReservations, today, this.horizon, roomCount);

    // 4. Calculate Daily Metrics for Calendar (including past 30 days for context)
    const dailyMetrics = this.calculateDailyMetrics(activeReservations, today, this.horizon, roomCount);

    // 5. Detect Gaps
    const gaps = this.detectGaps(pacing.periods);

    // 6. Calculate Weekly Cash Flow
    const cashFlow = this.calculateWeeklyCashFlow(activeReservations, today, this.horizon);

    // 7. Overall Trend
    const deltaVsLastYear = pacing.periods.reduce((sum, p) => sum + (p.current.occupancy - p.historical.occupancy), 0) / (pacing.periods.length || 1);
    const overallTrend = deltaVsLastYear > 2 ? 'ahead' : deltaVsLastYear < -2 ? 'behind' : 'on_track';

    const result: ProjectionsData = {
      horizon: this.horizon,
      summary,
      pacing: {
        periods: pacing.periods,
        overallTrend,
        deltaVsLastYear: Math.round(deltaVsLastYear * 10) / 10,
        isApproximate: pacing.isApproximate,
        diagnostics: pacing.diagnostics
      },
      daily: dailyMetrics,
      gaps,
      cashFlow
    };
    cacheService.set(cacheKey, result);
    return result;
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

  private calculateOTBSummary(reservations: any[], today: Date, horizonEnd: Date, roomCount: number) {
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
      const prorated = prorateReservationToPeriod(r, { start: todayStr, end: endStr });
      revenueOTB += prorated.revenueInPeriod;
      occupiedNights += prorated.nightsInPeriod;
      pendingCollections += prorated.pendingInPeriod;
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
      occupancyOTB: Math.round(calculateOccupancyPercent(occupiedNights, roomCount, this.horizon) * 10) / 10,
      pendingCollections: Math.round(pendingCollections),
      collectedPercent: revenueOTB > 0
        ? Math.max(0, Math.min(100, ((revenueOTB - pendingCollections) / revenueOTB) * 100))
        : 100,
      pickupLast7Days: {
        reservations: pickupRes.length,
        revenue: Math.round(pickupRes.reduce((sum, r) => sum + (Number(r.room_revenue_total) || 0), 0))
      }
    };
  }

  private async calculatePacing(
    reservations: any[],
    today: Date,
    horizon: number,
    roomCount: number
  ): Promise<{
    periods: PacingPeriod[];
    isApproximate: boolean;
    diagnostics?: {
      requestedAsOfSnapshotDate: string;
      availableSnapshotDates: string[];
      missingWeeks: number;
      totalWeeks: number;
      exactCoveragePercent: number;
      importedWeeks: number;
      reconstructedWeeks: number;
      approximatedWeeks: number;
    };
  }> {
    const periods: PacingPeriod[] = [];
    let usedApproximation = false;
    let missingWeeks = 0;
    let importedWeeks = 0;
    let reconstructedWeeks = 0;
    let approximatedWeeks = 0;
    const weeksCount = Math.ceil(horizon / 7);
    const lyAsOfDate = new Date(today);
    lyAsOfDate.setFullYear(today.getFullYear() - 1);
    const lyAsOfSnapshotDate = dateToIsoDay(lyAsOfDate);

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

      const exactSnapshot = await database.getReservationDailySnapshotMetrics(
        this.propertyId,
        lyAsOfSnapshotDate,
        lyWeekPeriod.start,
        lyWeekPeriod.end
      );

      let historicalMetrics: { revenue: number; occupancy: number; adr: number; nights: number };
      if (exactSnapshot && exactSnapshot.snapshotSource === 'imported') {
        importedWeeks += 1;
        const nights = exactSnapshot.occupiedNights;
        const revenue = exactSnapshot.revenue;
        historicalMetrics = {
          revenue: Math.round(revenue),
          occupancy: Math.round(calculateOccupancyPercent(nights, roomCount, lyWeekPeriod.days) * 10) / 10,
          adr: Math.round(nights > 0 ? revenue / nights : 0),
          nights: Math.round(nights),
        };
      } else if (exactSnapshot && exactSnapshot.snapshotSource === 'reconstructed') {
        // Reconstructed snapshots are better than raw reservation fallback, but still approximated.
        usedApproximation = true;
        missingWeeks += 1;
        reconstructedWeeks += 1;
        const nights = exactSnapshot.occupiedNights;
        const revenue = exactSnapshot.revenue;
        historicalMetrics = {
          revenue: Math.round(revenue),
          occupancy: Math.round(calculateOccupancyPercent(nights, roomCount, lyWeekPeriod.days) * 10) / 10,
          adr: Math.round(nights > 0 ? revenue / nights : 0),
          nights: Math.round(nights),
        };
      } else {
        usedApproximation = true;
        missingWeeks += 1;
        approximatedWeeks += 1;
        historicalMetrics = this.getMetricsForPeriod(reservations, lyWeekPeriod, lyAsOfDate, roomCount);
      }

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

    if (!usedApproximation) {
      return { periods, isApproximate: false };
    }

    const availableSnapshotDates = await database.getReservationDailySnapshotDates(this.propertyId, 12);
    const exactCoveragePercent = Math.round(((weeksCount - missingWeeks) / weeksCount) * 1000) / 10;

    return {
      periods,
      isApproximate: true,
      diagnostics: {
        requestedAsOfSnapshotDate: lyAsOfSnapshotDate,
        availableSnapshotDates,
        missingWeeks,
        totalWeeks: weeksCount,
        exactCoveragePercent,
        importedWeeks,
        reconstructedWeeks,
        approximatedWeeks,
      }
    };
  }

  private getMetricsForPeriod(reservations: any[], period: DatePeriod, asOfDate: Date, roomCount: number) {
    const metrics = aggregatePeriodMetrics(reservations, period, roomCount, { asOfDate });

    return {
      revenue: Math.round(metrics.revenue),
      occupancy: Math.round(metrics.occupancy * 10) / 10,
      adr: Math.round(metrics.adr),
      nights: Math.round(metrics.nights)
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

      const weekRes = reservations.filter((r) => {
        if (isExcludedReservationStatus(r.status)) {
          return false;
        }
        return getOverlappingNights(r, { start: weekStartStr, end: weekEndStr }) > 0;
      });

      const expected = weekRes.reduce((sum, r) => {
        return sum + prorateReservationToPeriod(r, { start: weekStartStr, end: weekEndStr }).revenueInPeriod;
      }, 0);
      const alreadyPaid = weekRes.reduce((sum, r) => {
        return sum + prorateReservationToPeriod(r, { start: weekStartStr, end: weekEndStr }).paidInPeriod;
      }, 0);
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

