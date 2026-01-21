/**
 * Utility functions for formatting values across the application
 * Centralized to avoid duplication
 */

// Global currency setting - can be updated by the app
let globalCurrency: string = 'ARS';

export function setGlobalCurrency(currency: string) {
  globalCurrency = currency;
}

export function getGlobalCurrency(): string {
  return globalCurrency;
}

/**
 * Get the compact symbol for a currency
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'ARS': '$',
    'USD': 'US$',
    'MXN': 'MX$',
    'COP': '$',
    'BRL': 'R$',
    'EUR': '€',
  };
  return symbols[currency] || '$';
}

/**
 * Format a number as currency
 * @param value - The number to format
 * @param options - Formatting options
 */
export function formatCurrency(
  value: number,
  options: {
    compact?: boolean;
    currency?: string;
    showSign?: boolean;
  } = {}
): string {
  const { compact = false, currency = globalCurrency, showSign = false } = options;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : showSign ? '+' : '';
  const symbol = getCurrencySymbol(currency);

  if (compact) {
    if (abs >= 1000000) {
      return `${sign}${symbol}${(abs / 1000000).toFixed(1)}M`;
    }
    if (abs >= 1000) {
      return `${sign}${symbol}${(abs / 1000).toFixed(0)}K`;
    }
    return `${sign}${symbol}${Math.round(abs)}`;
  }

  // Use locale based on currency
  const locale = currency === 'USD' ? 'en-US' : 
                 currency === 'EUR' ? 'de-DE' : 
                 currency === 'BRL' ? 'pt-BR' : 
                 currency === 'MXN' ? 'es-MX' : 
                 'es-AR';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Shorthand for compact currency formatting
 */
export function formatCurrencyShort(value: number, currency?: string): string {
  return formatCurrency(value, { compact: true, currency });
}

/**
 * Format a percentage value
 * @param value - The percentage (0-100 or 0-1)
 * @param options - Formatting options
 */
export function formatPercent(
  value: number,
  options: { decimals?: number; isDecimal?: boolean } = {}
): string {
  const { decimals = 0, isDecimal = false } = options;
  const percent = isDecimal ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a date in short format
 */
export function formatDateShort(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * Format a date in long format
 */
export function formatDateLong(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date range
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  return `${formatDateShort(start)} - ${formatDateShort(end)}`;
}

/**
 * Format a metric value based on its label/type
 */
export function formatMetricValue(value: number, label: string): string {
  if (label.includes('%')) {
    return `${value.toFixed(0)}%`;
  }
  if (
    label.includes('$') ||
    label.includes('comisiones') ||
    label.includes('cobro') ||
    label.includes('ahorro') ||
    label.includes('pendiente') ||
    label.includes('revenue') ||
    label.includes('profit')
  ) {
    return formatCurrency(value);
  }
  return formatNumber(value);
}

