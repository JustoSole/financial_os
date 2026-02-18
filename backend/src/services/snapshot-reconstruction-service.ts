import database from '../db';
import logger from './logger';
import {
  buildReservationDailySnapshotRows,
  dateToIsoDay,
  toDateOnly,
} from './metrics-core';

export interface SnapshotReconstructionOptions {
  snapshotDate: string;
  dryRun?: boolean;
}

export interface SnapshotReconstructionResult {
  propertyId: string;
  snapshotDate: string;
  dryRun: boolean;
  reservationsEvaluated: number;
  reservationsIncluded: number;
  rowsUpserted: number;
}

export async function reconstructReservationSnapshotAsOf(
  propertyId: string,
  options: SnapshotReconstructionOptions
): Promise<SnapshotReconstructionResult> {
  const snapshotDate = String(options.snapshotDate || '').substring(0, 10);
  const dryRun = Boolean(options.dryRun);
  if (!snapshotDate) {
    throw new Error('snapshotDate is required (YYYY-MM-DD).');
  }

  logger.info('SNAPSHOT_RECONSTRUCT', 'Starting reconstruction as-of snapshot', {
    propertyId,
    snapshotDate,
    dryRun,
  });

  if (!dryRun) {
    const snapshotsReady = await database.isReservationDailySnapshotsReady();
    if (!snapshotsReady) {
      throw new Error(
        'reservation_daily_snapshots table is missing. Apply migration backend/migrations/create_reservation_daily_snapshots.sql before reconstruction.'
      );
    }
  }

  const asOfDate = toDateOnly(snapshotDate);
  const reservations = await database.getAllReservations(propertyId);
  const filtered = reservations.filter((reservation: any) => {
    if (!reservation?.reservation_date) {
      return false;
    }
    const bookingDate = toDateOnly(reservation.reservation_date);
    return bookingDate <= asOfDate;
  });

  const rows = buildReservationDailySnapshotRows(propertyId, dateToIsoDay(asOfDate), filtered, {
    snapshotSource: 'reconstructed',
  });

  if (!dryRun && rows.length > 0) {
    await database.upsertReservationDailySnapshots(rows);
  }

  const result: SnapshotReconstructionResult = {
    propertyId,
    snapshotDate,
    dryRun,
    reservationsEvaluated: reservations.length,
    reservationsIncluded: filtered.length,
    rowsUpserted: rows.length,
  };

  logger.success(
    'SNAPSHOT_RECONSTRUCT',
    dryRun ? 'Reconstruction dry-run completed' : 'Reconstruction completed',
    result
  );

  return result;
}
