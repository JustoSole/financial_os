-- Fix: Enable RLS on reservation_daily_snapshots
-- This table was created without RLS, allowing any authenticated user to read all snapshots.

ALTER TABLE reservation_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snapshots" ON reservation_daily_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = reservation_daily_snapshots.property_id
        AND properties.user_id = auth.uid()
    )
  );
