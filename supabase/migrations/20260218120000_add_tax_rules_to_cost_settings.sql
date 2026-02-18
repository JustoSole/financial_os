-- Add tax_rules column to cost_settings for configuring taxes (IVA, city tax, etc.)
ALTER TABLE cost_settings ADD COLUMN IF NOT EXISTS tax_rules JSONB DEFAULT '[]'::jsonb;
