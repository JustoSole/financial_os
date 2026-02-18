create table if not exists reservation_daily_snapshots (
  property_id uuid not null,
  snapshot_date date not null,
  stay_date date not null,
  occupied_nights numeric not null default 0,
  revenue numeric not null default 0,
  paid_amount numeric not null default 0,
  pending_amount numeric not null default 0,
  snapshot_source text not null default 'imported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (property_id, snapshot_date, stay_date)
);

create index if not exists idx_res_daily_snapshots_property_snapshot
  on reservation_daily_snapshots (property_id, snapshot_date);

create index if not exists idx_res_daily_snapshots_property_stay
  on reservation_daily_snapshots (property_id, stay_date);
