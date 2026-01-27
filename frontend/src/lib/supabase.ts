import { createClient } from '@supabase/supabase-js';

// Usamos variables de entorno de Vite (VITE_...)
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing in frontend .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

