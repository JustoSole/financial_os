import { supabase } from '../db/supabase-client';
import logger from '../services/logger';
import { backfillReservationDailySnapshots } from '../services/snapshot-backfill-service';

async function run() {
  const limitArg = process.argv[2];
  const limit = Number.isFinite(Number(limitArg)) ? Number(limitArg) : 5000;
  const dryRunArg = process.argv[3];
  const dryRun = dryRunArg === '--dry-run';

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id,name')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Could not load properties: ${error.message}`);
  }

  if (!properties || properties.length === 0) {
    logger.warn('BACKFILL_ALL', 'No properties found to process');
    return;
  }

  logger.info('BACKFILL_ALL', 'Starting snapshots backfill for all properties', {
    properties: properties.length,
    limit,
    dryRun,
  });

  const results = [];
  for (const property of properties) {
    const result = await backfillReservationDailySnapshots(property.id, { limit, dryRun });
    results.push({
      propertyId: property.id,
      propertyName: property.name,
      snapshotsProcessed: result.snapshotsProcessed,
      rowsUpserted: result.rowsUpserted,
      skippedEmptyImports: result.skippedEmptyImports,
    });
  }

  logger.success('BACKFILL_ALL', dryRun ? 'Dry-run completed for all properties' : 'Backfill completed for all properties', {
    propertiesProcessed: results.length,
    results,
  });
}

run().catch((error) => {
  logger.error('BACKFILL_ALL', 'Backfill all failed', error);
  process.exit(1);
});
