-- Performance indexes for the two heaviest tables
-- These eliminate full table scans on the most frequent queries

-- reservation_financials: queried by property_id + date range on every page load
CREATE INDEX IF NOT EXISTS idx_res_fin_property_checkin
  ON reservation_financials(property_id, check_in DESC);

CREATE INDEX IF NOT EXISTS idx_res_fin_property_checkout
  ON reservation_financials(property_id, check_out);

CREATE INDEX IF NOT EXISTS idx_res_fin_property_status
  ON reservation_financials(property_id, status);

CREATE INDEX IF NOT EXISTS idx_res_fin_property_balance
  ON reservation_financials(property_id, balance_due)
  WHERE balance_due > 0;

CREATE INDEX IF NOT EXISTS idx_res_fin_property_source
  ON reservation_financials(property_id, source_file_id);

-- ledger_transactions: queried by property_id + date range for cash flow
CREATE INDEX IF NOT EXISTS idx_ledger_property_txn_at
  ON ledger_transactions(property_id, txn_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_property_hash
  ON ledger_transactions(property_id, row_hash);

-- import_files: queried on every engine init
CREATE INDEX IF NOT EXISTS idx_import_files_property_status
  ON import_files(property_id, status);

-- action_completions: queried per page load on Actions
CREATE INDEX IF NOT EXISTS idx_action_completions_property_date
  ON action_completions(property_id, completed_at DESC);
