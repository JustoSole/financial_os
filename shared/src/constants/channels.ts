/**
 * =====================================================
 * Financial OS - Channel Constants
 * Single source of truth for channel-related constants
 * =====================================================
 */

import type { ChannelCategory } from '../types/enums';

// =====================================================
// Default Commission Rates by Channel
// =====================================================

export const DEFAULT_CHANNEL_COMMISSIONS: Record<string, number> = {
  // OTAs
  'booking.com': 0.15,
  'booking': 0.15,
  'expedia': 0.18,
  'despegar/decolar': 0.18,
  'despegar': 0.18,
  'decolar': 0.18,
  'hotels.com': 0.20,
  'airbnb': 0.03,
  'vrbo': 0.08,
  'agoda': 0.15,
  'tripadvisor': 0.12,
  'hostelworld': 0.12,
  'kayak': 0.15,
  'trivago': 0.15,
  'google': 0.12,
  
  // Direct channels (0% commission)
  'direct': 0,
  'directo': 0,
  'walk-in': 0,
  'email': 0,
  'pagina web': 0,
  'website': 0,
  'teléfono': 0,
  'telefono': 0,
  'phone': 0,
  
  // Travel agencies
  'agencia de viajes': 0.10,
  'agente de viajes predeterminado': 0.10,
  'travel agency': 0.10,
  
  // Default fallback
  'default': 0.15,
};

// =====================================================
// Channel Category Classification
// =====================================================

/** Direct channel identifiers (case-insensitive) */
export const DIRECT_CHANNEL_IDENTIFIERS = [
  'walk-in',
  'email',
  'pagina web',
  'teléfono',
  'telefono',
  'website',
  'phone',
  'direct',
  'directo',
] as const;

/** OTA channel identifiers (case-insensitive, partial match) */
export const OTA_CHANNEL_IDENTIFIERS = [
  'booking.com',
  'booking',
  'expedia',
  'despegar',
  'decolar',
  'despegar/decolar',
  'airbnb',
  'hotels.com',
  'agoda',
  'tripadvisor',
  'kayak',
  'trivago',
  'hostelworld',
  'google',
] as const;

/** Travel agency identifiers (case-insensitive, partial match) */
export const AGENCY_CHANNEL_IDENTIFIERS = [
  'agencia',
  'agente',
  'viajes',
  'travel',
  'agency',
] as const;

/**
 * Categorizes a channel source into OTA, Direct, Agency, or Other
 * @param source - The channel source name
 * @returns The channel category
 */
export function categorizeChannel(source: string): ChannelCategory {
  const sourceLower = source.toLowerCase().trim();
  
  // Check direct channels first (exact match)
  if (DIRECT_CHANNEL_IDENTIFIERS.includes(sourceLower as any)) {
    return 'Direct';
  }
  
  // Check OTAs (partial match)
  if (OTA_CHANNEL_IDENTIFIERS.some(ota => sourceLower.includes(ota))) {
    return 'OTA';
  }
  
  // Check travel agencies (partial match)
  if (AGENCY_CHANNEL_IDENTIFIERS.some(agency => sourceLower.includes(agency))) {
    return 'Agencia de Viajes';
  }
  
  return 'Otro';
}

/**
 * Gets the commission rate for a channel
 * @param source - The channel source name
 * @param overrides - Custom commission overrides by channel
 * @param defaultRate - Default rate if not found (defaults to 0.15)
 * @returns The commission rate (0-1)
 */
export function getChannelCommissionRate(
  source: string,
  overrides?: Record<string, number>,
  defaultRate: number = 0.15
): number {
  const sourceLower = source.toLowerCase().trim();
  
  // Check overrides first
  if (overrides?.[sourceLower] !== undefined) {
    return overrides[sourceLower];
  }
  
  // Check default commissions
  if (DEFAULT_CHANNEL_COMMISSIONS[sourceLower] !== undefined) {
    return DEFAULT_CHANNEL_COMMISSIONS[sourceLower];
  }
  
  // Check if it's a direct channel (0 commission)
  const category = categorizeChannel(source);
  if (category === 'Direct') {
    return 0;
  }
  
  return defaultRate;
}

/**
 * Checks if a channel is considered "direct" (no commission)
 * @param source - The channel source name
 * @returns True if the channel is direct
 */
export function isDirectChannel(source: string): boolean {
  return categorizeChannel(source) === 'Direct';
}

/**
 * Gets all unique channels from a list with their categories
 * @param sources - Array of channel source names
 * @returns Array of unique channels with categories
 */
export function getUniqueChannelsWithCategories(
  sources: string[]
): Array<{ source: string; category: ChannelCategory }> {
  const unique = new Map<string, ChannelCategory>();
  
  for (const source of sources) {
    if (!unique.has(source)) {
      unique.set(source, categorizeChannel(source));
    }
  }
  
  return Array.from(unique.entries()).map(([source, category]) => ({
    source,
    category,
  }));
}

