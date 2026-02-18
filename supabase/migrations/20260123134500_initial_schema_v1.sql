-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. IMPORT FILES
CREATE TABLE IF NOT EXISTS import_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  rows INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  parser_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LEDGER TRANSACTIONS
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_file_id UUID REFERENCES import_files(id) ON DELETE SET NULL,
  txn_at TIMESTAMPTZ NOT NULL,
  reservation_number TEXT,
  reservation_source TEXT,
  txn_type TEXT,
  debits NUMERIC(15,2) DEFAULT 0,
  credits NUMERIC(15,2) DEFAULT 0,
  void_flag BOOLEAN DEFAULT false,
  refund_flag BOOLEAN DEFAULT false,
  adjustment_flag BOOLEAN DEFAULT false,
  description TEXT,
  notes TEXT,
  txn_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RESERVATION FINANCIALS
CREATE TABLE IF NOT EXISTS reservation_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_file_id UUID REFERENCES import_files(id) ON DELETE SET NULL,
  reservation_number TEXT NOT NULL,
  guest_name TEXT,
  status TEXT,
  source_category TEXT,
  source TEXT,
  check_in DATE,
  check_out DATE,
  room_nights INTEGER DEFAULT 0,
  room_revenue_total NUMERIC(15,2) DEFAULT 0,
  taxes_total NUMERIC(15,2) DEFAULT 0,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  balance_due NUMERIC(15,2) DEFAULT 0,
  suggested_deposit NUMERIC(15,2) DEFAULT 0,
  hotel_collect_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, reservation_number)
);

-- 5. CHANNEL SUMMARIES
CREATE TABLE IF NOT EXISTS channel_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_file_id UUID REFERENCES import_files(id) ON DELETE SET NULL,
  source_category TEXT,
  source TEXT NOT NULL,
  room_nights INTEGER DEFAULT 0,
  room_revenue_total NUMERIC(15,2) DEFAULT 0,
  estimated_commission NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. COST SETTINGS (Using JSONB for flexibility V4)
CREATE TABLE IF NOT EXISTS cost_settings (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  room_count INTEGER DEFAULT 0,
  starting_cash_balance NUMERIC(15,2) DEFAULT 0,
  
  -- Flexible JSONB storage for V4 categories
  variable_categories JSONB DEFAULT '[]'::jsonb,
  fixed_categories JSONB DEFAULT '[]'::jsonb,
  extraordinary_costs JSONB DEFAULT '[]'::jsonb,
  
  -- Legacy/Config structures
  variable_costs JSONB DEFAULT '{}'::jsonb,
  fixed_costs JSONB DEFAULT '{}'::jsonb,
  channel_commissions JSONB DEFAULT '{}'::jsonb,
  payment_fees JSONB DEFAULT '{}'::jsonb,
  
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ACTION COMPLETIONS
CREATE TABLE IF NOT EXISTS action_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  step_index INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES (Row Level Security)
-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for each table (Users can only see their own property data)
-- For properties: user_id must match auth.uid()
CREATE POLICY "Users can manage their own properties" ON properties
  FOR ALL USING (auth.uid() = user_id);

-- For other tables: must belong to a property the user owns
CREATE POLICY "Users can manage data of their properties" ON import_files
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = import_files.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can manage transactions" ON ledger_transactions
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = ledger_transactions.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can manage reservations" ON reservation_financials
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = reservation_financials.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can manage channel summaries" ON channel_summaries
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = channel_summaries.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can manage cost settings" ON cost_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = cost_settings.property_id AND properties.user_id = auth.uid()));

CREATE POLICY "Users can manage action completions" ON action_completions
  FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = action_completions.property_id AND properties.user_id = auth.uid()));
;
