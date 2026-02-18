-- Add new columns for string-based action and step IDs (for frontend-generated actions)
ALTER TABLE action_completions 
ADD COLUMN IF NOT EXISTS action_id TEXT,
ADD COLUMN IF NOT EXISTS step_id TEXT;

-- Make action_type nullable (since new format uses action_id instead)
ALTER TABLE action_completions 
ALTER COLUMN action_type DROP NOT NULL;

-- Create index for faster lookups by action_id
CREATE INDEX IF NOT EXISTS idx_action_completions_action_id 
ON action_completions(property_id, action_id) 
WHERE action_id IS NOT NULL;

-- Create unique constraint to prevent duplicate completions
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_completions_unique_step 
ON action_completions(property_id, action_id, step_id) 
WHERE action_id IS NOT NULL AND step_id IS NOT NULL;;
