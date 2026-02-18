-- Add reservation_date column to track when the booking was made
ALTER TABLE reservation_financials 
ADD COLUMN IF NOT EXISTS reservation_date DATE;;
