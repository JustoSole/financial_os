/**
 * Actions - Constants and types for the recommended actions system
 */

import type { ActionCategory, ActionSeverity } from '../types/api';
import type { ActionType } from '../types/enums';

export type { ActionCategory, ActionSeverity };
export type { ActionType };

/** Minimum balance due (in currency units) to suggest a collection action */
export const MIN_BALANCE_FOR_COLLECTION_ACTION = 10000;

/** Only suggest collection action if check-in was at least this many days ago */
export const DAYS_PAST_CHECKIN_FOR_COLLECTION = 3;

/** Channel real cost % above which we suggest optimization (e.g. 18%) */
export const CHANNEL_HIGH_COST_THRESHOLD_PERCENT = 18;

/** Action categories for filtering (UI order) */
export const ACTION_CATEGORIES: { value: ActionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'collections', label: 'Cobranza' },
  { value: 'channels', label: 'Canales' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'data', label: 'Datos' },
];

/** Map backend action type to display category */
export const ACTION_TYPE_TO_CATEGORY: Record<string, ActionCategory> = {
  ota_dependency: 'channels',
  channel_mix: 'channels',
  channel_cost: 'channels',
  cash_risk: 'cash',
  data_health: 'data',
  no_data: 'data',
  profitability: 'pricing',
  unprofitable_reservations: 'pricing',
  one_night_loss_pattern: 'pricing',
  pricing: 'pricing',
  collections: 'collections',
};
