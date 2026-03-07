import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { getCollectionsData } from './metrics-service';
import {
  RecommendedAction,
  ActionStep,
  DatePeriod,
  ActionCategory,
  ActionSeverity,
  MIN_BALANCE_FOR_COLLECTION_ACTION,
  DAYS_PAST_CHECKIN_FOR_COLLECTION,
  CHANNEL_HIGH_COST_THRESHOLD_PERCENT,
} from '../types';

/**
 * Actions Service - Generates recommended actions based on metrics
 *
 * All action generation is centralized here. Uses only data from the selected period
 * (disableFallback: true) to avoid comparing old rates with current costs.
 */
export async function generateActions(
  propertyId: string,
  startDateOrDays: string | number = 30,
  endDate?: string
): Promise<RecommendedAction[]> {
  let startStr: string;
  let endStr: string;
  let days: number;

  if (typeof startDateOrDays === 'string' && endDate) {
    startStr = startDateOrDays;
    endStr = endDate;
    const start = new Date(startStr);
    const end = new Date(endStr);
    days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  } else {
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }

  const period: DatePeriod = { start: startStr, end: endStr, days };
  const engine = new CalculationEngine(propertyId, period, { disableFallback: true });
  await engine.init();

  const reservations = engine.getReservations();
  const health = engine.getDataHealth();
  const actions: RecommendedAction[] = [];

  // 1. Data Health Action
  if (health.score < 80) {
    actions.push(normalizeAction({
      id: 'data-health',
      type: 'data_health',
      title: 'Mejorar Salud de Datos',
      description: 'Faltan reportes clave para un análisis completo.',
      category: 'data',
      severity: 'warning',
      priority: 1,
      impact: { value: 0, unit: 'reportes faltantes', direction: 'down' as const },
      steps: health.issues.map((issue: string, idx: number) => ({
        id: `data-health-${idx}`,
        text: issue,
        completed: false,
      })),
      evidence: health.issues.map((issue: string) => ({ metric: 'Falta', value: issue })),
      href: '/importar',
    }));
  }

  if (reservations.length === 0) {
    actions.push(normalizeAction({
      id: 'no-data',
      type: 'no_data',
      title: 'Sin datos en el período seleccionado',
      description: `No hay reservaciones en los últimos ${days} días. Importá datos más recientes o seleccioná otro período.`,
      category: 'data',
      severity: 'info',
      priority: 2,
      impact: { value: 0, unit: 'días', direction: 'down' as const },
      steps: [
        { id: 'no-data-0', text: 'Importar datos más recientes desde Cloudbeds', completed: false },
        { id: 'no-data-1', text: 'O seleccionar un período con datos existentes', completed: false },
      ],
      evidence: [],
      href: '/importar',
    }));
    return actions;
  }

  const economics = engine.getReservationEconomicsSummary();
  const channels = engine.getChannelMetrics();

  // 2. Collections actions (from getCollectionsData)
  const collectionsData = await getCollectionsData(propertyId, startStr, endStr);
  const collectionActions = generateCollectionsActions(collectionsData);
  actions.push(...collectionActions);

  // 3. Channel optimization (worst channel by real cost %)
  const channelActions = generateChannelActions(channels, startStr, endStr);
  actions.push(...channelActions);

  // 4. Pricing loss patterns (from economics)
  const pricingActions = generatePricingActions(economics, startStr, endStr);
  actions.push(...pricingActions);

  // 5. Unprofitable Reservations
  const unprofitable = economics.worstReservations?.filter((r: any) => r.netProfit < 0) || [];
  if (unprofitable.length > 0) {
    const totalLoss = unprofitable.reduce((sum: number, r: any) => sum + Math.abs(r.netProfit), 0);
    actions.push(normalizeAction({
      id: 'unprofitable-reservations',
      type: 'profitability',
      title: 'Optimizar Reservas No Rentables',
      description: `Tenés ${unprofitable.length} reservas que dieron pérdida en este período.`,
      category: 'pricing',
      severity: 'critical',
      priority: 1,
      impact: { value: Math.round(totalLoss), unit: 'pérdida evitable', direction: 'down' as const },
      steps: [
        { id: 'unprofitable-reservations-0', text: 'Revisar comisiones de canales caros', completed: false },
        { id: 'unprofitable-reservations-1', text: 'Ajustar precios mínimos en el simulador', completed: false },
        { id: 'unprofitable-reservations-2', text: 'Configurar cargo de limpieza para estadías cortas', completed: false },
      ],
      evidence: [
        { metric: 'Reservas con pérdida', value: String(unprofitable.length) },
        { metric: 'Pérdida total', value: `$${Math.round(totalLoss).toLocaleString()}` },
        { metric: 'Período analizado', value: `${startStr} a ${endStr}` },
      ],
      href: '/rentabilidad',
    }));
  }

  // 6. One-night Loss Pattern
  const oneNightLoss = economics.patterns?.find((p: any) => p.nightsBucket === '1' && p.isLossPattern);
  if (oneNightLoss) {
    actions.push(normalizeAction({
      id: 'one-night-loss-pattern',
      type: 'pricing',
      title: 'Fuga en Reservas de 1 Noche',
      description: `Las reservas de 1 noche en ${oneNightLoss.source} están perdiendo dinero.`,
      category: 'pricing',
      severity: 'critical',
      priority: 1,
      impact: {
        value: Math.round(oneNightLoss.lossAmount),
        unit: 'pérdida en 1 noche',
        direction: 'down' as const,
      },
      steps: [
        { id: 'one-night-loss-pattern-0', text: 'Aumentar tarifa base para 1 noche', completed: false },
        { id: 'one-night-loss-pattern-1', text: 'Configurar estancia mínima de 2 noches', completed: false },
      ],
      evidence: [
        { metric: 'Reservas', value: String(oneNightLoss.count) },
        { metric: 'Pérdida/noche', value: `$${Math.round(Math.abs(oneNightLoss.avgProfitPerNight)).toLocaleString()}` },
      ],
      href: '/rentabilidad',
    }));
  }

  // 7. OTA Dependency
  const totalRevenue = channels.channels.reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaRevenue = channels.channels
    .filter((c: any) => c.sourceCategory?.toLowerCase() === 'ota')
    .reduce((sum: number, c: any) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;
  if (otaShare > 70) {
    actions.push(normalizeAction({
      id: 'ota-dependency',
      type: 'ota_dependency',
      title: 'Reducir Dependencia de OTAs',
      description: `El ${otaShare.toFixed(0)}% de tus ingresos viene de OTAs.`,
      category: 'channels',
      severity: 'warning',
      priority: 2,
      impact: {
        value: Math.round(otaRevenue * 0.1 * 0.15),
        unit: 'ahorro potencial/mes',
        direction: 'up' as const,
      },
      steps: [
        { id: 'ota-dependency-0', text: 'Potenciar motor de reservas propio', completed: false },
        { id: 'ota-dependency-1', text: 'Campaña de fidelización para venta directa', completed: false },
      ],
      evidence: [
        { metric: 'Share OTA', value: `${otaShare.toFixed(0)}%` },
        { metric: 'Revenue OTA', value: `$${Math.round(otaRevenue).toLocaleString()}` },
      ],
      href: '/canales',
    }));
  }

  // 8. Channel Profit Leak
  if (channels.savingsPotential?.value > 50) {
    actions.push(normalizeAction({
      id: 'channel-profit-leak',
      type: 'channel_mix',
      title: 'Fuga de Profit por Canales',
      description: `Podrías ganar ${Math.round(channels.savingsPotential.value).toLocaleString()} más optimizando tu mix.`,
      category: 'channels',
      severity: 'critical',
      priority: 1,
      impact: {
        value: Math.round(channels.savingsPotential.value),
        unit: 'ganancia extra/mes',
        direction: 'up' as const,
      },
      steps: [
        { id: 'channel-profit-leak-0', text: `Reducir inventario en ${channels.insights?.worstChannel?.name || 'canales caros'}`, completed: false },
        { id: 'channel-profit-leak-1', text: 'Implementar markup de precios en OTAs de alto costo', completed: false },
        { id: 'channel-profit-leak-2', text: 'Ofrecer beneficios exclusivos en el motor directo', completed: false },
      ],
      evidence: [
        { metric: 'Ahorro potencial', value: `$${Math.round(channels.savingsPotential.value).toLocaleString()}` },
        { metric: 'Peor canal', value: channels.insights?.worstChannel?.name || 'N/A' },
      ],
      href: '/canales',
    }));
  }

  return sortActions(actions);
}

function generateCollectionsActions(collectionsData: any): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const list = collectionsData?.reservationsWithBalance || [];
  const today = new Date();

  for (const r of list) {
    const balanceDue = Number(r.balanceDue) || 0;
    if (balanceDue < MIN_BALANCE_FOR_COLLECTION_ACTION) continue;

    const checkIn = new Date(r.checkIn);
    const daysUntil = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isPastCheckIn = daysUntil < -DAYS_PAST_CHECKIN_FOR_COLLECTION;
    if (!isPastCheckIn) continue;

    const actionId = `collect-${r.reservationNumber}`;
    const step1Id = `${actionId}-verify`;
    const step2Id = `${actionId}-update`;
    const totalAmount = Number(r.totalAmount) || 0;
    const totalPaid = Number(r.paidAmount) || 0;
    const formatShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);

    actions.push(normalizeAction({
      id: actionId,
      type: 'collections',
      title: `Verificar pago: ${r.guestName || r.reservationNumber}`,
      description: `Check-in hace ${Math.abs(daysUntil)} días. Verificar si el pago fue registrado.`,
      category: 'collections',
      severity: 'info',
      priority: 2,
      impact: { value: balanceDue, unit: 'por verificar', direction: 'up' as const },
      steps: [
        { id: step1Id, text: `Verificar si el pago de ${r.guestName || 'huésped'} fue registrado`, completed: false },
        { id: step2Id, text: 'Actualizar registro si corresponde', completed: false },
      ],
      evidence: [
        { metric: 'Reserva', value: r.reservationNumber },
        { metric: 'Total', value: formatShort(totalAmount) },
        { metric: 'Registrado', value: formatShort(totalPaid) },
      ],
      href: undefined,
    }));
  }
  return actions;
}

function generateChannelActions(channels: any, startStr: string, endStr: string): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const channelList = channels?.channels || [];
  if (channelList.length === 0) return actions;

  const sortedByProfit = [...channelList].sort(
    (a: any, b: any) => (a.profitPerNight ?? a.revenue) - (b.profitPerNight ?? b.revenue)
  );
  const worst = sortedByProfit[0];
  const realCostPercent = worst?.realCostPercent ?? (worst?.effectiveCommissionRate ? worst.effectiveCommissionRate * 100 : 0);
  if (!worst || realCostPercent < CHANNEL_HIGH_COST_THRESHOLD_PERCENT) return actions;

  const channelSlug = (worst.source || worst.name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const actionId = `optimize-channel-${channelSlug}`;
  const step1Id = `${actionId}-raise-rate`;
  const step2Id = `${actionId}-parity`;
  const step3Id = `${actionId}-benefit`;
  const directChannel = channelList.find((c: any) => c.sourceCategory?.toLowerCase() === 'direct' || c.source?.toLowerCase() === 'direct');
  const directAdr = directChannel?.adr ?? worst.adr;
  const formatShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);

  actions.push(normalizeAction({
    id: actionId,
    type: 'channel_cost',
    title: `Optimizar ${worst.source || worst.name}`,
    description: `Costo real del ${realCostPercent.toFixed(0)}% (comisión ${((worst.effectiveCommissionRate ?? 0) * 100).toFixed(0)}% + ADR menor). Subí la tarifa o redirigí reservas.`,
    category: 'channels',
    severity: 'warning',
    priority: 2,
    impact: { value: Math.round((worst.revenue || 0) * 0.1), unit: '/mes potencial', direction: 'up' as const },
    steps: [
      { id: step1Id, text: `Subir tarifa en ${worst.source || worst.name} un 10-15%`, completed: false },
      { id: step2Id, text: 'Configurar paridad negativa (web 5% más barata)', completed: false },
      { id: step3Id, text: 'Agregar beneficio exclusivo para reserva directa', completed: false },
    ],
    evidence: [
      { metric: 'ADR canal', value: formatShort(worst.adr || 0) },
      { metric: 'ADR directo', value: formatShort(directAdr || 0) },
      { metric: 'Revenue', value: formatShort(worst.revenue || 0) },
    ],
    href: '/canales',
  }));
  return actions;
}

function generatePricingActions(economics: any, startStr: string, endStr: string): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const patterns = economics?.patterns?.filter((p: any) => p.isLossPattern) || [];

  for (const pattern of patterns) {
    const sourceSlug = (pattern.source || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const actionId = `pricing-${sourceSlug}-${pattern.nightsBucket}n`;
    const step1Id = `${actionId}-min-nights`;
    const step2Id = `${actionId}-raise-rate`;
    const step3Id = `${actionId}-cleaning-fee`;
    const formatShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);

    actions.push(normalizeAction({
      id: actionId,
      type: 'pricing',
      title: `Corregir: ${pattern.source} + ${pattern.nightsBucket}N`,
      description: `${pattern.count} reservas de ${pattern.source} con ${pattern.nightsBucket} noches dieron pérdida. Ajustá mínimo de noches o pricing.`,
      category: 'pricing',
      severity: 'warning',
      priority: 2,
      impact: { value: Math.abs(pattern.lossAmount || 0), unit: 'pérdida evitable', direction: 'down' as const },
      steps: [
        { id: step1Id, text: `Configurar mínimo de ${parseInt(pattern.nightsBucket, 10) + 1} noches en ${pattern.source}`, completed: false },
        { id: step2Id, text: 'Subir tarifa base para estadías cortas', completed: false },
        { id: step3Id, text: 'Agregar cargo de limpieza para 1 noche', completed: false },
      ],
      evidence: [
        { metric: 'Reservas', value: String(pattern.count) },
        { metric: 'Profit/noche', value: formatShort(pattern.avgProfitPerNight || 0) },
      ],
      href: '/rentabilidad',
    }));
  }
  return actions;
}

interface RawActionInput {
  id: string;
  type: string;
  title: string;
  description: string;
  category: ActionCategory;
  severity: ActionSeverity;
  priority: number;
  impact: { value: number; unit: string; direction: 'up' | 'down' };
  steps: ActionStep[];
  evidence: Array<{ metric: string; value: string }>;
  href?: string;
}

function normalizeAction(raw: RawActionInput): RecommendedAction {
  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    severity: raw.severity,
    priority: raw.priority,
    impact: raw.impact,
    steps: raw.steps.map(s => ({ id: s.id, text: s.text, completed: s.completed })),
    evidence: raw.evidence,
    href: raw.href,
  };
}

function sortActions(actions: RecommendedAction[]): RecommendedAction[] {
  const severityOrder: Record<ActionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  return [...actions].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.impact.value - a.impact.value;
  });
}

/**
 * Complete an action step - supports both legacy and new formats
 */
export async function completeActionStep(
  propertyId: string,
  actionIdOrType: string,
  stepIdOrIndex: string | number
): Promise<void> {
  const completion: any = {
    propertyId,
    completedAt: new Date().toISOString(),
  };
  if (typeof stepIdOrIndex === 'string') {
    completion.actionId = actionIdOrType;
    completion.stepId = stepIdOrIndex;
  } else {
    completion.actionType = actionIdOrType;
    completion.stepIndex = stepIdOrIndex;
  }
  await database.insertActionCompletion(completion);
}

/**
 * Get all completed steps for a property
 */
export async function getCompletedSteps(
  propertyId: string,
  daysBack: number = 30
): Promise<{
  byActionType: Record<string, number[]>;
  byActionId: Record<string, string[]>;
  actionStatus: Record<string, { status: 'done' | 'dismissed'; completedAt: string }>;
}> {
  const steps = await database.getCompletedSteps(propertyId, daysBack);
  const byActionType: Record<string, number[]> = {};
  const byActionId: Record<string, string[]> = {};
  const actionStatus: Record<string, { status: 'done' | 'dismissed'; completedAt: string }> = {};

  steps.forEach((s: any) => {
    if (s.action_type != null && s.step_index !== null && s.step_index !== undefined) {
      if (!byActionType[s.action_type]) byActionType[s.action_type] = [];
      if (!byActionType[s.action_type].includes(s.step_index)) {
        byActionType[s.action_type].push(s.step_index);
      }
    }
    if (s.action_id && s.step_id) {
      if (s.step_id === 'done' || s.step_id === 'dismissed') {
        const completedAt = s.completed_at || '';
        const existing = actionStatus[s.action_id];
        if (!existing || new Date(completedAt) > new Date(existing.completedAt)) {
          actionStatus[s.action_id] = { status: s.step_id as 'done' | 'dismissed', completedAt };
        }
      } else {
        if (!byActionId[s.action_id]) byActionId[s.action_id] = [];
        if (!byActionId[s.action_id].includes(s.step_id)) {
          byActionId[s.action_id].push(s.step_id);
        }
      }
    }
  });
  return { byActionType, byActionId, actionStatus };
}
