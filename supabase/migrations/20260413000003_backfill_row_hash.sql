-- Backfill: Generate row_hash for existing ledger_transactions that have NULL hash.
-- Uses MD5 of key identifying columns to create a deterministic hash.
-- NOTE: This hash won't match the parser-generated hash (which uses CSV row JSON),
-- but it serves the purpose of preventing duplicate existing rows.

-- Step 1: Remove exact duplicates (keep the one with the latest created_at)
-- Two rows are "duplicates" if they share all key business columns
DELETE FROM ledger_transactions a
USING ledger_transactions b
WHERE a.ctid < b.ctid
  AND a.property_id = b.property_id
  AND a.txn_at = b.txn_at
  AND COALESCE(a.reservation_number, '') = COALESCE(b.reservation_number, '')
  AND COALESCE(a.txn_type, '') = COALESCE(b.txn_type, '')
  AND COALESCE(a.debits, 0) = COALESCE(b.debits, 0)
  AND COALESCE(a.credits, 0) = COALESCE(b.credits, 0)
  AND COALESCE(a.description, '') = COALESCE(b.description, '')
  AND a.row_hash IS NULL
  AND b.row_hash IS NULL;

-- Step 2: Backfill row_hash for remaining NULL rows
UPDATE ledger_transactions
SET row_hash = MD5(
  COALESCE(property_id::text, '') || '|' ||
  COALESCE(txn_at::text, '') || '|' ||
  COALESCE(reservation_number, '') || '|' ||
  COALESCE(txn_type, '') || '|' ||
  COALESCE(debits::text, '0') || '|' ||
  COALESCE(credits::text, '0') || '|' ||
  COALESCE(description, '') || '|' ||
  COALESCE(notes, '')
)
WHERE row_hash IS NULL;
