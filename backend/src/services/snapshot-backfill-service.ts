import database from '../db';
import logger from './logger';
import {
  buildReservationDailySnapshotRows,
  dateToIsoDay,
} from './metrics-core';

export interface SnapshotBackfillOptions {
  limit?: number;
  dryRun?: boolean;
}

export interface SnapshotBackfillResult {
  propertyId: string;
  limit: number;
  dryRun: boolean;
  importsFound: number;
  snapshotsProcessed: number;
  rowsUpserted: number;
  skippedEmptyImports: number;
}

export async function backfillReservationDailySnapshots(
  propertyId: string,
  options: SnapshotBackfillOptions = {}
): Promise<SnapshotBackfillResult> {
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 5000;
  const dryRun = Boolean(options.dryRun);

  logger.info('BACKFILL', 'Starting reservation daily snapshots backfill', {
    propertyId,
    limit,
    dryRun,
  });

  if (!dryRun) {
    const snapshotsReady = await database.isReservationDailySnapshotsReady();
    if (!snapshotsReady) {
      throw new Error(
        'reservation_daily_snapshots table is missing. Apply migration backend/migrations/create_reservation_daily_snapshots.sql before running non-dry backfill.'
      );
    }
  }

  const importFiles = await database.getImportFilesByProperty(propertyId, limit);
  const reservationImports = importFiles
    .filter((f: any) => f.report_type === 'reservations_financials' && f.status === 'processed')
    .sort((a: any, b: any) => {
      const aTime = new Date(a.uploaded_at).getTime();
      const bTime = new Date(b.uploaded_at).getTime();
      return aTime - bTime;
    });

  if (reservationImports.length === 0) {
    logger.warn('BACKFILL', 'No processed reservations imports found', { propertyId });
    return {
      propertyId,
      limit,
      dryRun,
      importsFound: 0,
      snapshotsProcessed: 0,
      rowsUpserted: 0,
      skippedEmptyImports: 0,
    };
  }

  let snapshotsProcessed = 0;
  let rowsUpserted = 0;
  let skippedEmptyImports = 0;

  for (const importFile of reservationImports) {
    const sourceFileId = importFile.id;
    const snapshotDate = dateToIsoDay(new Date(importFile.uploaded_at));
    const reservations = await database.getReservationsBySourceFile(propertyId, sourceFileId);

    if (reservations.length === 0) {
      skippedEmptyImports += 1;
      continue;
    }

    const snapshotRows = buildReservationDailySnapshotRows(propertyId, snapshotDate, reservations);
    if (!dryRun) {
      await database.upsertReservationDailySnapshots(snapshotRows);
    }

    snapshotsProcessed += 1;
    rowsUpserted += snapshotRows.length;

    logger.info('BACKFILL', dryRun ? 'Snapshot analyzed (dry-run)' : 'Snapshot backfilled', {
      sourceFileId,
      snapshotDate,
      reservations: reservations.length,
      snapshotRows: snapshotRows.length,
    });
  }

  const result: SnapshotBackfillResult = {
    propertyId,
    limit,
    dryRun,
    importsFound: reservationImports.length,
    snapshotsProcessed,
    rowsUpserted,
    skippedEmptyImports,
  };

  logger.success('BACKFILL', dryRun ? 'Dry-run completed' : 'Backfill completed', result);
  return result;
}
