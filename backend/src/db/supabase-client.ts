import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Usar SERVICE_ROLE_KEY si está disponible (bypassa RLS), sino ANON_KEY
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials missing in .env');
}

// Cliente principal - usa SERVICE_ROLE_KEY si está disponible
export const supabase = createClient(supabaseUrl, supabaseKey);

// Indica si estamos usando SERVICE_ROLE_KEY (bypassa RLS)
export const hasServiceRoleKey = !!supabaseServiceKey;

/**
 * Crea un cliente Supabase autenticado con el token JWT del usuario.
 * Esto es necesario cuando usamos ANON_KEY y las tablas tienen RLS.
 * El cliente hereda el contexto auth del usuario para que las políticas RLS funcionen.
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

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

