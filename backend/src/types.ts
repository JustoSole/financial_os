/**
 * Backend Types - Re-exports from shared + backend-specific
 */

// Re-export everything from shared (single source of truth)
export * from '@financial-os/shared';

// Backend-specific: DB row format (snake_case for JSON storage)
export interface DBCostSettings {
  property_id: string;
  room_count: number;
  starting_cash_balance: number;
  variable_categories?: Array<{ id: string; name: string; monthlyAmount: number }>;
  fixed_categories?: Array<{ id: string; name: string; monthlyAmount: number }>;
  variable_costs: {
    cleaningPerStay: number;
    laundryMonthly: number;
    amenitiesMonthly: number;
  };
  fixed_costs: {
    salaries: number;
    rent: number;
    utilities: number;
    other: number;
  };
  channel_commissions: {
  defaultRate: number;
  byChannel: Record<string, number>;
  };
  payment_fees: {
  enabled: boolean;
  defaultRate: number;
  byMethod: Record<string, number>;
  };
  updated_at: string;
}
