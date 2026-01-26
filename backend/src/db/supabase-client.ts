import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to get the current property ID from the request or context.
 * In a real app, this would come from the auth token.
 * For the beta, we might need a way to pass this or derive it.
 */
export const getActivePropertyId = async () => {
  // For now, return a placeholder or the first property found for the user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return property?.id || null;
};

