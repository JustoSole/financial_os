import { DatePeriod } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_STATUSES = new Set(['cancelled', 'no show']);

export const DIRECT_CHANNEL_ALIASES = new Set([
  'direct',
  'directo',
  'walk-in',
  'email',
  'pagina web',
  'teléfono',
  'telefono',
  'website',
  'phone',
]);

export interface AggregatedPeriodMetrics {
  revenue: number;
  nights: number;
  occupancy: number;
  adr: number;
  revpar: number;
}

export interface ProratedReservation {
  nightsInPeriod: number;
  totalNights: number;
  ratio: number;
  revenueInPeriod: number;
  paidInPeriod: number;
  pendingInPeriod: number;
}

export interface ReservationDailySnapshotRow {
  property_id: string;
  snapshot_date: string;
  stay_date: string;
  occupied_nights: number;
  revenue: number;
  paid_amount: number;
  pending_amount: number;
  snapshot_source: 'imported' | 'reconstructed';
}

export function isExcludedReservationStatus(status: unknown): boolean {
  return EXCLUDED_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isDirectChannel(source: unknown, sourceCategory?: unknown): boolean {
  const normalizedSource = String(source || '').trim().toLowerCase();
  if (DIRECT_CHANNEL_ALIASES.has(normalizedSource)) {
    return true;
  }

  return String(sourceCategory || '').trim().toLowerCase() === 'direct';
}

export function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const normalized = String(value).substring(0, 10);
  return new Date(`${normalized}T00:00:00Z`);
}

export function dateToIsoDay(value: Date): string {
  return value.toISOString().substring(0, 10);
}

export function getOverlappingNights(
  reservation: any,
  period: Pick<DatePeriod, 'start' | 'end'>
): number {
  const checkIn = toDateOnly(reservation.check_in);
  const checkOut = toDateOnly(reservation.check_out);
  const periodStart = toDateOnly(period.start);
  const periodEnd = toDateOnly(period.end);

  const start = checkIn > periodStart ? checkIn : periodStart;
  const end = checkOut < periodEnd ? checkOut : periodEnd;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

export function getReservationTotalNights(reservation: any): number {
  const checkIn = toDateOnly(reservation.check_in);
  const checkOut = toDateOnly(reservation.check_out);
  return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_MS));
}

export function prorateReservationToPeriod(
  reservation: any,
  period: Pick<DatePeriod, 'start' | 'end'>
): ProratedReservation {
  const nightsInPeriod = getOverlappingNights(reservation, period);
  const totalNights = getReservationTotalNights(reservation);
  const ratio = totalNights > 0 ? nightsInPeriod / totalNights : 0;

  return {
    nightsInPeriod,
    totalNights,
    ratio,
    revenueInPeriod: (Number(reservation.room_revenue_total) || 0) * ratio,
    paidInPeriod: (Number(reservation.paid_amount) || 0) * ratio,
    pendingInPeriod: (Number(reservation.balance_due) || 0) * ratio,
  };
}

export function reservationOverlapsPeriod(
  reservation: any,
  period: Pick<DatePeriod, 'start' | 'end'>
): boolean {
  if (isExcludedReservationStatus(reservation.status)) {
    return false;
  }

  const checkIn = String(reservation.check_in || '').substring(0, 10);
  const checkOut = String(reservation.check_out || '').substring(0, 10);
  return checkIn <= period.end && checkOut > period.start;
}

export function calculateOccupancyPercent(nights: number, roomCount: number, days: number): number {
  const denominator = roomCount * days;
  if (denominator <= 0) {
    return 0;
  }

  const raw = (nights / denominator) * 100;
  return Math.min(100, Math.max(0, raw));
}

export function calculateAdr(revenue: number, nights: number): number {
  return nights > 0 ? revenue / nights : 0;
}

export function calculateRevpar(revenue: number, roomCount: number, days: number): number {
  const denominator = roomCount * days;
  return denominator > 0 ? revenue / denominator : 0;
}

export function aggregatePeriodMetrics(
  reservations: any[],
  period: DatePeriod,
  roomCount: number,
  options?: { asOfDate?: Date }
): AggregatedPeriodMetrics {
  let revenue = 0;
  let nights = 0;
  const asOfDate = options?.asOfDate ? toDateOnly(options.asOfDate) : null;

  for (const reservation of reservations) {
    if (!reservationOverlapsPeriod(reservation, period)) {
      continue;
    }

    if (asOfDate) {
      const bookingDateRaw = reservation.reservation_date;
      if (!bookingDateRaw) {
        continue;
      }
      const bookingDate = toDateOnly(bookingDateRaw);
      if (bookingDate > asOfDate) {
        continue;
      }
    }

    const prorated = prorateReservationToPeriod(reservation, period);
    revenue += prorated.revenueInPeriod;
    nights += prorated.nightsInPeriod;
  }

  return {
    revenue,
    nights,
    occupancy: calculateOccupancyPercent(nights, roomCount, period.days),
    adr: calculateAdr(revenue, nights),
    revpar: calculateRevpar(revenue, roomCount, period.days),
  };
}

export function buildReservationDailySnapshotRows(
  propertyId: string,
  snapshotDate: string,
  reservations: any[],
  options?: { snapshotSource?: 'imported' | 'reconstructed' }
): ReservationDailySnapshotRow[] {
  const snapshotSource = options?.snapshotSource || 'imported';
  const rowsByStayDate = new Map<string, ReservationDailySnapshotRow>();

  for (const reservation of reservations) {
    if (isExcludedReservationStatus(reservation.status)) {
      continue;
    }

    const checkIn = toDateOnly(reservation.check_in);
    const checkOut = toDateOnly(reservation.check_out);
    const totalNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_MS));
    const revenuePerNight = (Number(reservation.room_revenue_total) || 0) / totalNights;
    const paidPerNight = (Number(reservation.paid_amount) || 0) / totalNights;
    const pendingPerNight = (Number(reservation.balance_due) || 0) / totalNights;

    for (let cursor = new Date(checkIn); cursor < checkOut; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const stayDate = dateToIsoDay(cursor);
      const existing = rowsByStayDate.get(stayDate) || {
        property_id: propertyId,
        snapshot_date: snapshotDate,
        stay_date: stayDate,
        occupied_nights: 0,
        revenue: 0,
        paid_amount: 0,
        pending_amount: 0,
        snapshot_source: snapshotSource,
      };

      existing.occupied_nights += 1;
      existing.revenue += revenuePerNight;
      existing.paid_amount += paidPerNight;
      existing.pending_amount += pendingPerNight;
      rowsByStayDate.set(stayDate, existing);
    }
  }

  return Array.from(rowsByStayDate.values());
}
