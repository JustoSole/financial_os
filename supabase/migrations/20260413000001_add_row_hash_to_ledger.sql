-- Fix: Add missing row_hash column to ledger_transactions
-- The backend computes row_hash for deduplication (supabase-adapter.ts upsert),
-- but the column was never created. The index in 20260218150000 also references it.

ALTER TABLE ledger_transactions
  ADD COLUMN IF NOT EXISTS row_hash TEXT;

-- Create unique constraint for the upsert onConflict clause
-- (This also creates an implicit index, making the explicit idx_ledger_property_hash unnecessary)
ALTER TABLE ledger_transactions
  ADD CONSTRAINT uq_ledger_property_row_hash UNIQUE (property_id, row_hash);

-- Drop the broken index from 20260218150000 if it somehow exists
DROP INDEX IF EXISTS idx_ledger_property_hash;
