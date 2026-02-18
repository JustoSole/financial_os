alter table if exists reservation_daily_snapshots
  add column if not exists snapshot_source text not null default 'imported';

update reservation_daily_snapshots
set snapshot_source = coalesce(nullif(snapshot_source, ''), 'imported')
where snapshot_source is null or snapshot_source = '';
