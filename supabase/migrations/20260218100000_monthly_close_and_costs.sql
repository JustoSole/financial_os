-- Monthly Close & Costs per Period
-- Adds monthly_periods, cost_categories, monthly_cost_entries, monthly_cash_balances, import_jobs

-- =====================================================
-- 1) monthly_periods
-- =====================================================
create table if not exists monthly_periods (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  month text not null,
  status text not null default 'open' check (status in ('open','closed','closed_with_warnings')),
  confidence_score numeric not null default 0,
  checks_json jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  closed_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_periods_month_fmt check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint monthly_periods_property_month_uq unique (property_id, month)
);

alter table monthly_periods enable row level security;
create policy "Users manage own property periods"
  on monthly_periods for all
  using (property_id in (select id from properties where user_id = auth.uid()))
  with check (property_id in (select id from properties where user_id = auth.uid()));

-- =====================================================
-- 2) cost_categories (system catalog)
-- =====================================================
create table if not exists cost_categories (
  category_key text primary key,
  display_name text not null,
  cost_type_default text not null default 'fixed' check (cost_type_default in ('fixed','variable','extraordinary')),
  sort_order int not null default 100,
  active boolean not null default true,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed initial categories
insert into cost_categories (category_key, display_name, cost_type_default, sort_order) values
  ('salaries', 'Sueldos', 'fixed', 10),
  ('rent', 'Alquiler', 'fixed', 20),
  ('utilities', 'Servicios (luz, gas, agua)', 'fixed', 30),
  ('software', 'Software (PMS, etc)', 'fixed', 40),
  ('insurance', 'Seguros', 'fixed', 50),
  ('maintenance', 'Mantenimiento', 'fixed', 60),
  ('laundry', 'Lavandería', 'variable', 70),
  ('amenities', 'Amenities', 'variable', 80),
  ('supplies', 'Insumos', 'variable', 90),
  ('cleaning', 'Limpieza por estadía', 'variable', 95),
  ('marketing', 'Marketing', 'fixed', 100),
  ('other', 'Otros', 'fixed', 999)
on conflict (category_key) do nothing;

alter table cost_categories enable row level security;
create policy "Anyone can read categories"
  on cost_categories for select using (true);

-- =====================================================
-- 3) monthly_cost_entries
-- =====================================================
create table if not exists monthly_cost_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  month text not null,
  category_key text not null references cost_categories(category_key),
  cost_type text not null check (cost_type in ('fixed','variable','extraordinary')),
  amount numeric not null default 0,
  source text not null default 'manual' check (source in ('manual','external_costs_csv','migration','fallback')),
  note text,
  source_job_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mce_month_fmt check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint mce_property_month_cat_type_uq unique (property_id, month, category_key, cost_type)
);

alter table monthly_cost_entries enable row level security;
create policy "Users manage own property cost entries"
  on monthly_cost_entries for all
  using (property_id in (select id from properties where user_id = auth.uid()))
  with check (property_id in (select id from properties where user_id = auth.uid()));

create index if not exists idx_mce_property_month on monthly_cost_entries(property_id, month);

-- =====================================================
-- 4) monthly_cash_balances
-- =====================================================
create table if not exists monthly_cash_balances (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  month text not null,
  balance numeric not null default 0,
  as_of_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual','migration','api')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcb_month_fmt check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint mcb_property_month_uq unique (property_id, month)
);

alter table monthly_cash_balances enable row level security;
create policy "Users manage own property cash balances"
  on monthly_cash_balances for all
  using (property_id in (select id from properties where user_id = auth.uid()))
  with check (property_id in (select id from properties where user_id = auth.uid()));

-- =====================================================
-- 5) import_jobs (enhanced tracking)
-- =====================================================
create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  job_type text not null check (job_type in ('pms_transactions','pms_reservations','external_costs_csv')),
  source_system text not null default 'pms' check (source_system in ('pms','external')),
  status text not null default 'processing' check (status in ('processing','processed','failed','partial','duplicated')),
  target_month text,
  coverage_start date,
  coverage_end date,
  months_covered text[],
  file_name text not null,
  file_hash text not null,
  rows_total int not null default 0,
  rows_ok int not null default 0,
  rows_error int not null default 0,
  error_log jsonb not null default '[]'::jsonb,
  import_file_id uuid,
  uploaded_by uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ij_target_month_fmt check (target_month is null or target_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

alter table import_jobs enable row level security;
create policy "Users manage own property import jobs"
  on import_jobs for all
  using (property_id in (select id from properties where user_id = auth.uid()))
  with check (property_id in (select id from properties where user_id = auth.uid()));

create index if not exists idx_ij_property_created on import_jobs(property_id, created_at desc);
create index if not exists idx_ij_property_month on import_jobs(property_id, target_month, created_at desc);
