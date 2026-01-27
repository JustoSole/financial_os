import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded client instance
let _supabaseClient: SupabaseClient | null = null;

/**
 * Gets the Supabase configuration from Vite environment variables.
 * Returns null if credentials are missing.
 */
type RuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

function getRuntimeEnv(): RuntimeEnv {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__ as RuntimeEnv;
  }
  return {};
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const runtimeEnv = getRuntimeEnv();
  const supabaseUrl =
    (import.meta as any).env.VITE_SUPABASE_URL ||
    runtimeEnv.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    (import.meta as any).env.VITE_SUPABASE_ANON_KEY ||
    runtimeEnv.VITE_SUPABASE_ANON_KEY ||
    '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  return {
    url: supabaseUrl,
    key: supabaseAnonKey
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
        '❌ Supabase credentials not configured in frontend. Please set the following environment variables:\n' +
        '   - VITE_SUPABASE_URL: Your Supabase project URL\n' +
        '   - VITE_SUPABASE_ANON_KEY: Your Supabase anon/publishable key\n' +
        '\n' +
        '   These should be set in your build environment (Render, Vercel, etc.) or in a .env file for local development.'
      );
    }
    
    _supabaseClient = createClient(config.url, config.key);
    console.log('✅ Supabase client initialized (frontend)');
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
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

