-- Remove monthly close feature: drop monthly_periods table.
-- Costos mensuales (monthly_cost_entries, monthly_cash_balances) and cost_categories remain.
-- DROP TABLE removes the table and its RLS policies; safe if table never existed.

drop table if exists monthly_periods;
