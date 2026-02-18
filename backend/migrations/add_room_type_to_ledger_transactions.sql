-- Migration: Add room_type column to ledger_transactions
-- Date: 2025-01-28
-- Description: Adds room_type column to support room type filtering and segmentation

-- Add room_type column
ALTER TABLE ledger_transactions 
ADD COLUMN IF NOT EXISTS room_type TEXT NULL;

-- Create index for efficient filtering by room_type
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_room_type 
ON ledger_transactions(property_id, room_type);

-- Add comment to column
COMMENT ON COLUMN ledger_transactions.room_type IS 'Normalized room type from Transactions CSV (Room Type column)';

