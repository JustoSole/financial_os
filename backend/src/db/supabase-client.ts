import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Lazy-loaded client instance
let _supabaseClient: SupabaseClient | null = null;
let _initialized = false;

/**
 * Gets the Supabase configuration from environment variables.
 * Returns null if credentials are missing.
 */
function getSupabaseConfig(): { url: string; key: string; hasServiceRole: boolean } | null {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  // Usar SERVICE_ROLE_KEY si está disponible (bypassa RLS), sino ANON_KEY
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  
  return {
    url: supabaseUrl,
    key: supabaseKey,
    hasServiceRole: !!supabaseServiceKey
  };
}

/**
 * Lazily initializes and returns the Supabase client.
 * Throws a descriptive error if credentials are missing.
 */
function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const config = getSupabaseConfig();
    
    if (!config) {
      throw new Error(
        '❌ Supabase credentials not configured. Please set the following environment variables:\n' +
        '   - SUPABASE_URL: Your Supabase project URL\n' +
        '   - SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY: Your Supabase API key\n' +
        '\n' +
        '   For Render deployments, add these in the Environment tab of your service settings.'
      );
    }
    
    _supabaseClient = createClient(config.url, config.key);
    _initialized = true;
    console.log('✅ Supabase client initialized');
  }
  
  return _supabaseClient;
}

/**
 * Checks if Supabase credentials are configured (without initializing).
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/**
 * Main Supabase client - lazily initialized on first access.
 * Uses SERVICE_ROLE_KEY if available.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Indica si estamos usando SERVICE_ROLE_KEY (bypassa RLS)
export const hasServiceRoleKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Crea un cliente Supabase autenticado con el token JWT del usuario.
 * Esto es necesario cuando usamos ANON_KEY y las tablas tienen RLS.
 * El cliente hereda el contexto auth del usuario para que las políticas RLS funcionen.
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '❌ Cannot create authenticated client: SUPABASE_URL and SUPABASE_ANON_KEY are required.'
    );
  }
  
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

