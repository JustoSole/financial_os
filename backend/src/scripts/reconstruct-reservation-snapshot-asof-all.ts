import { supabase } from '../db/supabase-client';
import logger from '../services/logger';
import { reconstructReservationSnapshotAsOf } from '../services/snapshot-reconstruction-service';

async function run() {
  const snapshotDate = process.argv[2];
  const dryRunArg = process.argv[3];
  const dryRun = dryRunArg === '--dry-run';

  if (!snapshotDate) {
    console.error('Usage: npm run reconstruct:snapshot:asof:all -- <YYYY-MM-DD> [--dry-run]');
    process.exit(1);
  }

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id,name')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Could not load properties: ${error.message}`);
  }
  if (!properties || properties.length === 0) {
    logger.warn('SNAPSHOT_RECONSTRUCT_ALL', 'No properties found to process');
    return;
  }

  logger.info(
    'SNAPSHOT_RECONSTRUCT_ALL',
    'Starting reconstruction for all properties',
    { snapshotDate, dryRun, properties: properties.length }
  );

  const results = [];
  for (const property of properties) {
    const result = await reconstructReservationSnapshotAsOf(property.id, { snapshotDate, dryRun });
    results.push({
      propertyId: property.id,
      propertyName: property.name,
      rowsUpserted: result.rowsUpserted,
      reservationsIncluded: result.reservationsIncluded,
    });
  }

  logger.success(
    'SNAPSHOT_RECONSTRUCT_ALL',
    dryRun ? 'Dry-run completed for all properties' : 'Reconstruction completed for all properties',
    { propertiesProcessed: results.length, results }
  );
}

run().catch((error) => {
  logger.error('SNAPSHOT_RECONSTRUCT_ALL', 'Failed', error);
  process.exit(1);
});
