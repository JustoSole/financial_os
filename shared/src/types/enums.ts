/**
 * =====================================================
 * Financial OS - Enums & Literal Types
 * Single source of truth for all enum-like types
 * =====================================================
 */

/** Trust level indicates data reliability */
export type TrustLevel = 'real' | 'estimado' | 'incompleto';

/** Confidence level for calculated metrics */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Types of recommended actions */
export type ActionType = 
  | 'cash_risk' 
  | 'collections' 
  | 'deposit_gap' 
  | 'ota_dependency' 
  | 'channel_cost' 
  | 'data_quality'
  | 'unprofitable_reservations'
  | 'one_night_loss_pattern'
  | 'commission_override_needed'
  | 'costs_data_gap';

/** User plan types (MVP: solo free y pro) */
export type PlanType = 'free' | 'pro';

/** Supported report types from Cloudbeds */
export type ReportType = 
  | 'expanded_transactions' 
  | 'reservations_financials' 
  | 'channel_performance';

/** Data health level */
export type DataHealthLevel = 'completos' | 'parciales' | 'faltan';

/** Channel category classification */
export type ChannelCategory = 'OTA' | 'Direct' | 'Agencia de Viajes' | 'Otro';

/** Reservation status */
export type ReservationStatus = 
  | 'Confirmed' 
  | 'Checked In' 
  | 'Checked Out' 
  | 'Cancelled' 
  | 'No Show'
  | string; // Allow other statuses from PMS

/** Import file status */
export type ImportStatus = 'processed' | 'failed';

/** Weekly action type */
export type WeeklyActionType = 
  | 'reduce_commission' 
  | 'raise_adr' 
  | 'cut_costs' 
  | 'collect_pending' 
  | 'improve_data';

/** Alert severity levels */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** KPI status */
export type KPIStatus = 'good' | 'warning' | 'bad';

/** Break-even status */
export type BreakEvenStatus = 'profitable' | 'at_risk' | 'losing';

/** Cash runway status */
export type RunwayStatus = 'safe' | 'warning' | 'danger';

