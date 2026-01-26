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

export async function completeActionStep(propertyId: string, actionType: string, stepIndex: number): Promise<void> {
  await database.insertActionCompletion({
    propertyId,
    actionType,
    stepIndex,
    completedAt: new Date().toISOString()
  });
}

export async function getCompletedSteps(propertyId: string, daysBack: number = 30): Promise<any> {
  const steps = await database.getCompletedSteps(propertyId, daysBack);
  const grouped: Record<string, number[]> = {};
  
  steps.forEach((s: any) => {
    if (!grouped[s.action_type]) grouped[s.action_type] = [];
    grouped[s.action_type].push(s.step_index);
  });
  
  return grouped;
}
