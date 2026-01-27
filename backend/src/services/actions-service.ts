import database from '../db';
import cacheService from '../services/cache-service';
import { 
  calculateHomeMetrics, 
  calculateCashMetrics, 
  calculateChannelMetrics,
  getCollectionsData,
} from './metrics-service';
import { calculateReservationEconomicsSummary } from './reservation-economics-service';
import { 
  RecommendedAction,
  ActionType,
  ActionStep,
  HomeMetrics,
  CashMetrics,
  ChannelMetrics,
  CollectionsData
} from '../types';

/**
 * Actions Service - Generates recommended actions based on metrics
 */
export async function generateActions(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any[]> {
  const actions: any[] = [];

  const home = await calculateHomeMetrics(propertyId, startDateOrDays, endDate);
  const cash = await calculateCashMetrics(propertyId, startDateOrDays, endDate);
  const channels = await calculateChannelMetrics(propertyId, startDateOrDays, endDate);
  const economics = await calculateReservationEconomicsSummary(propertyId, startDateOrDays, endDate);
  const health = await database.getDataHealth(propertyId);

  // 1. Data Health Action
  if (health.score < 80) {
    actions.push({
      type: 'data_health',
      title: 'Mejorar Salud de Datos',
      description: 'Faltan reportes clave para un análisis completo.',
      priority: 1,
      steps: health.issues.map((issue: string) => ({
        label: issue,
        completed: false
      }))
    });
  }

  // 2. Unprofitable Reservations Action
  if (economics.unprofitableCount > 0) {
    actions.push({
      type: 'profitability',
      title: 'Optimizar Reservas No Rentables',
      description: `Tenés ${economics.unprofitableCount} reservas que dieron pérdida.`,
      priority: 1,
      steps: [
        { label: 'Revisar comisiones de canales caros', completed: false },
        { label: 'Ajustar precios mínimos', completed: false }
      ]
    });
  }

  // 3. OTA Dependency Action
  const totalRevenue = channels.channels.reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaRevenue = channels.channels
    .filter((c: any) => c.sourceCategory.toLowerCase() === 'ota')
    .reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;

  if (otaShare > 70) {
    actions.push({
      type: 'ota_dependency',
      title: 'Reducir Dependencia de OTAs',
      description: `El ${otaShare.toFixed(0)}% de tus ingresos viene de OTAs.`,
      priority: 2,
      steps: [
        { label: 'Potenciar motor de reservas propio', completed: false },
        { label: 'Campaña de fidelización para venta directa', completed: false }
      ]
    });
  }

  return actions;
}

/**
 * Complete an action step - supports both legacy and new formats
 * @param propertyId - The property ID
 * @param actionIdOrType - Either a full actionId (string like "collect-RES123") or legacy actionType
 * @param stepIdOrIndex - Either a stepId (string like "collect-RES123-1") or legacy numeric index
 */
export async function completeActionStep(
  propertyId: string, 
  actionIdOrType: string, 
  stepIdOrIndex: string | number
): Promise<void> {
  const completion: any = {
    propertyId,
    completedAt: new Date().toISOString()
  };

  // New format: stepId is a string (e.g., "collect-RES123-1")
  if (typeof stepIdOrIndex === 'string') {
    completion.actionId = actionIdOrType;
    completion.stepId = stepIdOrIndex;
  } else {
    // Legacy format: stepIndex is a number
    completion.actionType = actionIdOrType;
    completion.stepIndex = stepIdOrIndex;
  }

  await database.insertActionCompletion(completion);
}

/**
 * Get all completed steps for a property
 * Returns two formats:
 * - byActionType: Legacy format { actionType: [stepIndex, ...] }
 * - byActionId: New format { actionId: [stepId, ...] }
 */
export async function getCompletedSteps(propertyId: string, daysBack: number = 30): Promise<{
  byActionType: Record<string, number[]>;
  byActionId: Record<string, string[]>;
}> {
  const steps = await database.getCompletedSteps(propertyId, daysBack);
  
  const byActionType: Record<string, number[]> = {};
  const byActionId: Record<string, string[]> = {};
  
  steps.forEach((s: any) => {
    // Legacy format
    if (s.action_type && s.step_index !== null && s.step_index !== undefined) {
      if (!byActionType[s.action_type]) byActionType[s.action_type] = [];
      if (!byActionType[s.action_type].includes(s.step_index)) {
        byActionType[s.action_type].push(s.step_index);
      }
    }
    // New format
    if (s.action_id && s.step_id) {
      if (!byActionId[s.action_id]) byActionId[s.action_id] = [];
      if (!byActionId[s.action_id].includes(s.step_id)) {
        byActionId[s.action_id].push(s.step_id);
      }
    }
  });
  
  return { byActionType, byActionId };
}
