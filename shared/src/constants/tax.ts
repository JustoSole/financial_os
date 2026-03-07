/**
 * =====================================================
 * Financial OS - Tax Constants
 * Single source of truth for default tax configuration
 * =====================================================
 */

import type { TaxRule } from '../types/models';

export const DEFAULT_TAX_RULES: TaxRule[] = [
  {
    id: 'iva',
    name: 'IVA',
    type: 'VAT',
    appliesTo: 'room_rate',
    method: 'percentage',
    value: 21,
    includedInRate: true,
  },
];
