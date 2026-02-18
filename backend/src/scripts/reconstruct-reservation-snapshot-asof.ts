import logger from '../services/logger';
import { reconstructReservationSnapshotAsOf } from '../services/snapshot-reconstruction-service';

async function run() {
  const propertyId = process.argv[2];
  const snapshotDate = process.argv[3];
  const dryRunArg = process.argv[4];
  const dryRun = dryRunArg === '--dry-run';

  if (!propertyId || !snapshotDate) {
    console.error(
      'Usage: npm run reconstruct:snapshot:asof -- <propertyId> <YYYY-MM-DD> [--dry-run]'
    );
    process.exit(1);
  }

  const result = await reconstructReservationSnapshotAsOf(propertyId, { snapshotDate, dryRun });
  logger.info('SNAPSHOT_RECONSTRUCT_SCRIPT', dryRun ? 'Dry-run completed' : 'Completed', result);
}

run().catch((error) => {
  logger.error('SNAPSHOT_RECONSTRUCT_SCRIPT', 'Failed', error);
  process.exit(1);
});
