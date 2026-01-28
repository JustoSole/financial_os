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
  const unprofitable = economics.worstReservations?.filter((r: any) => r.netProfit < 0) || [];
  if (unprofitable.length > 0) {
    const totalLoss = unprofitable.reduce((sum: number, r: any) => sum + Math.abs(r.netProfit), 0);
    actions.push({
      id: 'unprofitable-reservations',
      type: 'profitability',
      title: 'Optimizar Reservas No Rentables',
      description: `Tenés ${unprofitable.length} reservas que dieron pérdida en este período.`,
      priority: 1,
      impact: {
        value: Math.round(totalLoss),
        unit: 'pérdida evitable',
        direction: 'down'
      },
      steps: [
        { text: 'Revisar comisiones de canales caros', completed: false },
        { text: 'Ajustar precios mínimos en el simulador', completed: false },
        { text: 'Configurar cargo de limpieza para estadías cortas', completed: false }
      ],
      evidence: [
        { metric: 'Reservas con pérdida', value: String(unprofitable.length) },
        { metric: 'Pérdida total', value: `$${Math.round(totalLoss).toLocaleString()}` }
      ]
    });
  }

  // 3. One-night Loss Pattern Action
  const oneNightLoss = economics.patterns?.find((p: any) => p.nightsBucket === '1' && p.isLossPattern);
  if (oneNightLoss) {
    actions.push({
      id: 'one-night-loss-pattern',
      type: 'pricing',
      title: 'Fuga en Reservas de 1 Noche',
      description: `Las reservas de 1 noche en ${oneNightLoss.source} están perdiendo dinero.`,
      priority: 1,
      impact: {
        value: Math.round(oneNightLoss.lossAmount),
        unit: 'pérdida en 1 noche',
        direction: 'down'
      },
      steps: [
        { text: 'Aumentar tarifa base para 1 noche', completed: false },
        { text: 'Configurar estancia mínima de 2 noches', completed: false }
      ],
      evidence: [
        { metric: 'Reservas', value: String(oneNightLoss.count) },
        { metric: 'Pérdida/noche', value: `$${Math.round(Math.abs(oneNightLoss.avgProfitPerNight)).toLocaleString()}` }
      ]
    });
  }

  // 4. OTA Dependency Action
  const totalRevenue = channels.channels.reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaRevenue = channels.channels
    .filter((c: any) => c.sourceCategory.toLowerCase() === 'ota')
    .reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;

  if (otaShare > 70) {
    actions.push({
      id: 'ota-dependency',
      type: 'ota_dependency',
      title: 'Reducir Dependencia de OTAs',
      description: `El ${otaShare.toFixed(0)}% de tus ingresos viene de OTAs.`,
      priority: 2,
      impact: {
        value: Math.round(otaRevenue * 0.1 * 0.15), // 10% shift to direct saves ~15% commission
        unit: 'ahorro potencial/mes',
        direction: 'up'
      },
      steps: [
        { text: 'Potenciar motor de reservas propio', completed: false },
        { text: 'Campaña de fidelización para venta directa', completed: false }
      ],
      evidence: [
        { metric: 'Share OTA', value: `${otaShare.toFixed(0)}%` },
        { metric: 'Revenue OTA', value: `$${Math.round(otaRevenue).toLocaleString()}` }
      ]
    });
  }

  // 5. Channel Profit Leak Action (Savings Potential)
  if (channels.savingsPotential?.value > 50) {
    actions.push({
      id: 'channel-profit-leak',
      type: 'channel_mix',
      title: 'Fuga de Profit por Canales',
      description: `Podrías ganar ${Math.round(channels.savingsPotential.value).toLocaleString()} más optimizando tu mix.`,
      priority: 1,
      impact: {
        value: Math.round(channels.savingsPotential.value),
        unit: 'ganancia extra/mes',
        direction: 'up'
      },
      steps: [
        { text: `Reducir inventario en ${channels.insights?.worstChannel?.name || 'canales caros'}`, completed: false },
        { text: 'Implementar markup de precios en OTAs de alto costo', completed: false },
        { text: 'Ofrecer beneficios exclusivos en el motor directo', completed: false }
      ],
      evidence: [
        { metric: 'Ahorro potencial', value: `$${Math.round(channels.savingsPotential.value).toLocaleString()}` },
        { metric: 'Peor canal', value: channels.insights?.worstChannel?.name || 'N/A' }
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
