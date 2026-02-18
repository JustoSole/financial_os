import logger from '../services/logger';
import { backfillReservationDailySnapshots } from '../services/snapshot-backfill-service';

async function run() {
  const propertyId = process.argv[2];
  const limitArg = process.argv[3];
  const limit = Number.isFinite(Number(limitArg)) ? Number(limitArg) : 5000;
  const dryRunArg = process.argv[4];
  const dryRun = dryRunArg === '--dry-run';

  if (!propertyId) {
    console.error('Usage: npm run backfill:snapshots -- <propertyId> [limit] [--dry-run]');
    process.exit(1);
  }

  await backfillReservationDailySnapshots(propertyId, { limit, dryRun });
}

run().catch((error) => {
  logger.error('BACKFILL', 'Backfill failed', error);
  process.exit(1);
});
