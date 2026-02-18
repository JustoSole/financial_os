import { describe, expect, it } from 'vitest';
import {
  aggregatePeriodMetrics,
  buildReservationDailySnapshotRows,
  calculateOccupancyPercent,
  getOverlappingNights,
  prorateReservationToPeriod,
} from './index';

describe('metrics-core', () => {
  const reservation = {
    status: 'Confirmed',
    check_in: '2026-01-10',
    check_out: '2026-01-15',
    room_nights: 5,
    room_revenue_total: 500,
    paid_amount: 200,
    balance_due: 300,
  };

  it('prorratea reserva que inicia antes y termina dentro del periodo', () => {
    const period = { start: '2026-01-12', end: '2026-01-20' };
    const prorated = prorateReservationToPeriod(reservation, period);

    expect(prorated.nightsInPeriod).toBe(3);
    expect(prorated.ratio).toBeCloseTo(0.6);
    expect(prorated.revenueInPeriod).toBeCloseTo(300);
    expect(prorated.paidInPeriod).toBeCloseTo(120);
    expect(prorated.pendingInPeriod).toBeCloseTo(180);
  });

  it('calcula nights con overlap real', () => {
    const overlap = getOverlappingNights(reservation, { start: '2026-01-14', end: '2026-01-16' });
    expect(overlap).toBe(1);
  });

  it('agrega metricas del periodo con ocupacion en escala 0-100', () => {
    const metrics = aggregatePeriodMetrics(
      [
        reservation,
        {
          ...reservation,
          check_in: '2026-01-12',
          check_out: '2026-01-13',
          room_revenue_total: 100,
        },
      ],
      { start: '2026-01-12', end: '2026-01-14', days: 2 },
      2
    );

    expect(metrics.nights).toBeCloseTo(3);
    expect(metrics.revenue).toBeCloseTo(300);
    expect(metrics.occupancy).toBeLessThanOrEqual(100);
    expect(metrics.occupancy).toBeCloseTo(75);
  });

  it('nunca excede 100% de ocupacion', () => {
    expect(calculateOccupancyPercent(200, 1, 1)).toBe(100);
  });

  it('genera snapshot diario de estadias para pacing exacto', () => {
    const rows = buildReservationDailySnapshotRows('prop-1', '2026-02-10', [reservation]);
    expect(rows.length).toBe(5);
    expect(rows[0].snapshot_date).toBe('2026-02-10');
    expect(rows.reduce((sum, r) => sum + r.occupied_nights, 0)).toBe(5);
    expect(rows.reduce((sum, r) => sum + r.revenue, 0)).toBeCloseTo(500);
  });
});
