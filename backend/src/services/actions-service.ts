import { nanoid } from 'nanoid';
import database from '../db';
import { 
  RecommendedAction, 
  ActionType, 
  ConfidenceLevel,
  DEFAULT_CHANNEL_COMMISSIONS,
  UI_COPY 
} from '../types';
import { calculateCashMetrics, calculateChannelMetrics, getCollectionsData, getDepositGaps } from './metrics-service';
import { 
  calculateReservationEconomicsSummary, 
  getChannelLossPatterns,
  checkCostsConfigured 
} from './reservation-economics-service';

// =====================================================
// Actions Service - Decision Engine (Section 8)
// Triggers v1:
// 1. cash_risk: runway < 30 días
// 2. collections: top reservas con balance due alto
// 3. deposit_gap: suggested deposit vs paid amount
// 4. ota_dependency: OTA share > 70%
// 5. channel_cost: canal dominante + comisión alta
// 6. data_quality: score < 70
// =====================================================

export function generateActions(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  
  // Check all triggers
  const cashRisk = checkCashRisk(propertyId, startDateOrDays, endDate);
  if (cashRisk) actions.push(cashRisk);
  
  const collections = checkCollections(propertyId); // Collections is usually global/current state, but we could filter if needed. Keeping as is for now unless specified.
  if (collections) actions.push(collections);
  
  const depositGap = checkDepositGap(propertyId); // Same for deposit gaps
  if (depositGap) actions.push(depositGap);
  
  const otaDependency = checkOtaDependency(propertyId, startDateOrDays, endDate);
  if (otaDependency) actions.push(otaDependency);
  
  const channelCost = checkChannelCost(propertyId, startDateOrDays, endDate);
  if (channelCost) actions.push(channelCost);
  
  const dataQuality = checkDataQuality(propertyId);
  if (dataQuality) actions.push(dataQuality);
  
  // NEW: Reservation Economics actions
  const unprofitableReservations = checkUnprofitableReservations(propertyId, startDateOrDays, endDate);
  if (unprofitableReservations) actions.push(unprofitableReservations);
  
  const oneNightLossPattern = checkOneNightLossPattern(propertyId, startDateOrDays, endDate);
  if (oneNightLossPattern) actions.push(oneNightLossPattern);
  
  const commissionOverrideNeeded = checkCommissionOverrideNeeded(propertyId, startDateOrDays, endDate);
  if (commissionOverrideNeeded) actions.push(commissionOverrideNeeded);
  
  const costsDataGap = checkCostsDataGap(propertyId, startDateOrDays, endDate);
  if (costsDataGap) actions.push(costsDataGap);
  
  // Sort by priority (1=highest) and then by impact value desc
  actions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.impact.value - a.impact.value;
  });
  
  return actions;
}

// =====================================================
// 1. Cash Risk - runway < 30 días
// =====================================================

function checkCashRisk(propertyId: string, startDateOrDays: string | number = 90, endDate?: string): RecommendedAction | null {
  const cashMetrics = calculateCashMetrics(propertyId, startDateOrDays, endDate);
  
  // Only trigger if we have starting balance and runway is concerning
  if (cashMetrics.runway.startingBalance === 0) {
    return null; // No cash balance configured
  }
  
  if (cashMetrics.runway.days >= 30) {
    return null; // Cash is fine
  }
  
  const runwayDays = cashMetrics.runway.days;
  const startingBalance = cashMetrics.runway.startingBalance;
  const dailyBurn = Math.abs(cashMetrics.runway.avgNetDaily);
  
  return {
    id: nanoid(),
    type: 'cash_risk',
    title: UI_COPY.actions.cash_risk.title,
    description: `Tu caja actual alcanza para ${runwayDays} días. ${runwayDays < 15 ? '⚠️ Situación crítica.' : ''}`,
    impact: {
      value: dailyBurn * 30,
      unit: '$/mes',
      direction: 'down',
    },
    confidence: 'medium',
    steps: [
      { text: 'Revisá los pagos pendientes de cobrar', completed: false },
      { text: 'Acelerá la cobranza de reservas con saldo', completed: false },
      { text: 'Evaluá reducir gastos fijos si es posible', completed: false },
    ],
    evidence: [
      { metric: 'Días de caja', value: `${runwayDays} días` },
      { metric: 'Balance inicial', value: `$${startingBalance.toLocaleString()}` },
      { metric: 'Flujo neto diario', value: `$${Math.round(cashMetrics.runway.avgNetDaily).toLocaleString()}` },
    ],
    priority: runwayDays < 15 ? 1 : 2,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 2. Collections - reservas con balance due alto
// =====================================================

function checkCollections(propertyId: string): RecommendedAction | null {
  const collections = getCollectionsData(propertyId);
  
  if (collections.totalBalanceDue < 1000) {
    return null; // Not significant
  }
  
  const topReservations = collections.reservationsWithBalance.slice(0, 5);
  const topTotal = topReservations.reduce((sum, r) => sum + r.balanceDue, 0);
  
  return {
    id: nanoid(),
    type: 'collections',
    title: UI_COPY.actions.collections.title,
    description: `Tenés $${Math.round(collections.totalBalanceDue).toLocaleString()} pendientes de cobro en ${collections.reservationsWithBalance.length} reservas.`,
    impact: {
      value: collections.totalBalanceDue,
      unit: '$',
      direction: 'up',
    },
    confidence: 'high',
    steps: [
      { text: `Contactar top ${topReservations.length} reservas con mayor deuda`, completed: false },
      { text: 'Verificar fechas de check-in próximas', completed: false },
      { text: 'Actualizar estados de pago en Cloudbeds', completed: false },
    ],
    evidence: [
      { metric: 'Total pendiente', value: `$${Math.round(collections.totalBalanceDue).toLocaleString()}` },
      { metric: 'Reservas con saldo', value: `${collections.reservationsWithBalance.length}` },
      { metric: 'Top 5 concentran', value: `$${Math.round(topTotal).toLocaleString()}` },
    ],
    priority: 2,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 3. Deposit Gap - suggested > paid
// =====================================================

function checkDepositGap(propertyId: string): RecommendedAction | null {
  const gaps = getDepositGaps(propertyId);
  
  if (gaps.length === 0) {
    return null;
  }
  
  const totalGap = gaps.reduce((sum, g) => sum + g.deposit_gap, 0);
  
  if (totalGap < 500) {
    return null; // Not significant
  }
  
  const topGaps = gaps.slice(0, 5);
  
  return {
    id: nanoid(),
    type: 'deposit_gap',
    title: UI_COPY.actions.deposit_gap.title,
    description: `${gaps.length} reservas no alcanzaron el depósito sugerido. Gap total: $${Math.round(totalGap).toLocaleString()}`,
    impact: {
      value: totalGap,
      unit: '$',
      direction: 'up',
    },
    confidence: 'high',
    steps: [
      { text: 'Revisar política de depósitos', completed: false },
      { text: 'Contactar reservas próximas a check-in', completed: false },
      { text: 'Considerar confirmar solo con depósito completo', completed: false },
    ],
    evidence: [
      { metric: 'Reservas con gap', value: `${gaps.length}` },
      { metric: 'Gap total', value: `$${Math.round(totalGap).toLocaleString()}` },
      { metric: 'Gap promedio', value: `$${Math.round(totalGap / gaps.length).toLocaleString()}` },
    ],
    priority: 3,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 4. OTA Dependency - share > 70%
// =====================================================

function checkOtaDependency(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  const channelMetrics = calculateChannelMetrics(propertyId, startDateOrDays, endDate);
  
  // Check OTA share
  const otaChannels = channelMetrics.channels.filter(c => 
    c.sourceCategory.toLowerCase() === 'ota'
  );
  const totalRevenue = channelMetrics.channels.reduce((sum, c) => sum + c.revenue, 0);
  const otaRevenue = otaChannels.reduce((sum, c) => sum + c.revenue, 0);
  const otaShare = totalRevenue > 0 ? otaRevenue / totalRevenue : 0;
  
  if (otaShare < 0.7) {
    return null; // Not concerning
  }
  
  const avgOtaCommission = otaChannels.length > 0
    ? otaChannels.reduce((sum, c) => sum + c.effectiveCommissionRate, 0) / otaChannels.length
    : 0.15;
  
  const commissionPaid = otaRevenue * avgOtaCommission;
  
  return {
    id: nanoid(),
    type: 'ota_dependency',
    title: UI_COPY.actions.ota_dependency.title,
    description: `${(otaShare * 100).toFixed(0)}% de tus ingresos vienen de OTAs. Estás pagando ~$${Math.round(commissionPaid).toLocaleString()} en comisiones.`,
    impact: {
      value: commissionPaid * 0.3, // Potential savings if reduce dependency
      unit: '$/mes',
      direction: 'up',
    },
    confidence: 'medium',
    steps: [
      { text: 'Mejorar tu motor de reservas directo', completed: false },
      { text: 'Crear incentivos para reservas directas', completed: false },
      { text: 'Invertir en marketing digital propio', completed: false },
      { text: 'Implementar programa de fidelización', completed: false },
    ],
    evidence: [
      { metric: 'Share de OTAs', value: `${(otaShare * 100).toFixed(0)}%` },
      { metric: 'Revenue de OTAs', value: `$${Math.round(otaRevenue).toLocaleString()}` },
      { metric: 'Comisión promedio', value: `${(avgOtaCommission * 100).toFixed(0)}%` },
    ],
    priority: 4,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 5. Channel Cost - canal dominante con comisión alta
// =====================================================

function checkChannelCost(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  const channelMetrics = calculateChannelMetrics(propertyId, startDateOrDays, endDate);
  
  if (channelMetrics.channels.length === 0) {
    return null;
  }
  
  // Find most expensive channel with significant revenue
  const significantChannels = channelMetrics.channels.filter(c => c.revenueShare > 0.1);
  
  if (significantChannels.length === 0) {
    return null;
  }
  
  const mostExpensive = significantChannels.reduce((max, c) => 
    c.effectiveCommissionRate > max.effectiveCommissionRate ? c : max
  );
  
  // Only trigger if commission rate is high (>12%)
  if (mostExpensive.effectiveCommissionRate < 0.12) {
    return null;
  }
  
  const commissionAmount = mostExpensive.revenue * mostExpensive.effectiveCommissionRate;
  const potentialSavings = commissionAmount * 0.2; // If negotiate 20% reduction
  
  return {
    id: nanoid(),
    type: 'channel_cost',
    title: UI_COPY.actions.channel_cost.title,
    description: `${mostExpensive.source} tiene ${(mostExpensive.effectiveCommissionRate * 100).toFixed(0)}% de comisión sobre $${Math.round(mostExpensive.revenue).toLocaleString()} de revenue.`,
    impact: {
      value: potentialSavings,
      unit: '$/mes',
      direction: 'up',
    },
    confidence: mostExpensive.isCommissionEstimated ? 'medium' : 'high',
    steps: [
      { text: `Verificar contrato con ${mostExpensive.source}`, completed: false },
      { text: 'Negociar mejor tasa por volumen', completed: false },
      { text: 'Evaluar canales alternativos con menor comisión', completed: false },
    ],
    evidence: [
      { metric: 'Canal', value: mostExpensive.source },
      { metric: 'Comisión efectiva', value: `${(mostExpensive.effectiveCommissionRate * 100).toFixed(1)}%` },
      { metric: 'Comisión pagada', value: `~$${Math.round(commissionAmount).toLocaleString()}` },
    ],
    priority: 5,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 6. Data Quality - score < 70
// =====================================================

function checkDataQuality(propertyId: string): RecommendedAction | null {
  const dataHealth = database.getDataHealth(propertyId);
  
  if (dataHealth.score >= 70) {
    return null;
  }
  
  return {
    id: nanoid(),
    type: 'data_quality',
    title: UI_COPY.actions.data_quality.title,
    description: `Tu score de datos es ${dataHealth.score}/100. Faltan reportes para darte mejores recomendaciones.`,
    impact: {
      value: 0,
      unit: '$',
      direction: 'up',
    },
    confidence: 'high',
    steps: dataHealth.issues.map(issue => ({
      text: issue.replace('Falta', 'Importar'),
      completed: false,
    })),
    evidence: [
      { metric: 'Score de datos', value: `${dataHealth.score}/100` },
      { metric: 'Nivel', value: dataHealth.level },
      { metric: 'Último import', value: dataHealth.lastImport ? new Date(dataHealth.lastImport).toLocaleDateString() : 'Nunca' },
    ],
    priority: dataHealth.score < 50 ? 1 : 6,
    isActive: true,
    triggeredAt: new Date().toISOString(),
  };
}

// =====================================================
// 7. Unprofitable Reservations - reservas con pérdida
// Trigger: count_unprofitable >= max(3, 5% of total)
// =====================================================

function checkUnprofitableReservations(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  try {
    const economics = calculateReservationEconomicsSummary(propertyId, startDateOrDays, endDate);
    
    // Trigger threshold: at least 3 or 5% of total
    const threshold = Math.max(3, economics.totalReservations * 0.05);
    
    if (economics.unprofitableCount < threshold) {
      return null;
    }
    
    // Calculate monthly impact
    const monthlyLoss = economics.unprofitableLoss;
    
    // Get top patterns causing losses
    const lossPatterns = economics.patterns.filter(p => p.isLossPattern).slice(0, 2);
    const mainCause = lossPatterns[0] 
      ? `${lossPatterns[0].source} con ${lossPatterns[0].nightsBucket} noche(s)` 
      : 'mix de canales y estadías cortas';
    
    // Get sample reservations
    const sampleReservations = economics.worstReservations.slice(0, 3).map(r => r.reservationNumber);
    
    return {
      id: nanoid(),
      type: 'unprofitable_reservations',
      title: UI_COPY.actions.unprofitable_reservations.title,
      description: `${economics.unprofitableCount} reservas te hicieron perder $${Math.round(economics.unprofitableLoss).toLocaleString()} en este periodo. Principal causa: ${mainCause}.`,
      impact: {
        value: monthlyLoss,
        unit: '$/mes',
        direction: 'down',
      },
      confidence: economics.lowConfidenceShare > 20 ? 'medium' : 'high',
      steps: [
        { text: 'Revisar las reservas no rentables en detalle', completed: false },
        { text: 'Identificar patrones: estadía corta, canal, temporada', completed: false },
        { text: 'Ajustar mínimo de estadía o precio piso', completed: false },
        { text: 'Verificar que los costos configurados sean correctos', completed: false },
      ],
      evidence: [
        { metric: 'Reservas no rentables', value: `${economics.unprofitableCount}` },
        { metric: 'Pérdida total', value: `$${Math.round(economics.unprofitableLoss).toLocaleString()}` },
        { metric: 'Peor reserva', value: sampleReservations[0] || '-' },
        { metric: '% del total', value: `${economics.unprofitableShare.toFixed(1)}%` },
      ],
      priority: monthlyLoss > 100000 ? 1 : 2,
      isActive: true,
      triggeredAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Error checking unprofitable reservations:', e);
    return null;
  }
}

// =====================================================
// 8. One Night Loss Pattern - estadías de 1 noche pierden
// Trigger: avg_profit_per_night < 0 for 1-night bucket and count >= 5
// =====================================================

function checkOneNightLossPattern(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  try {
    const lossPatterns = getChannelLossPatterns(propertyId, startDateOrDays, endDate);
    
    // Find 1-night loss patterns with significant count
    const oneNightLosses = lossPatterns.filter(p => 
      p.nightsBucket === '1' && p.count >= 5 && p.avgProfitPerNight < 0
    );
    
    if (oneNightLosses.length === 0) {
      return null;
    }
    
    // Get worst offender
    const worst = oneNightLosses[0];
    
    // Calculate monthly impact (assuming pattern continues)
    const monthlyImpact = worst.lossAmount;
    
    return {
      id: nanoid(),
      type: 'one_night_loss_pattern',
      title: `${worst.source}: estadías de 1 noche pierden plata`,
      description: `${worst.count} reservas de 1 noche en ${worst.source} generaron pérdida de $${Math.round(worst.lossAmount).toLocaleString()}. Promedio: $${Math.abs(worst.avgProfitPerNight).toLocaleString()}/noche de pérdida.`,
      impact: {
        value: monthlyImpact,
        unit: '$/mes',
        direction: 'down',
      },
      confidence: 'high',
      steps: [
        { text: `Configurar mínimo 2 noches en ${worst.source}`, completed: false },
        { text: 'Revisar si el precio de 1 noche cubre costos', completed: false },
        { text: 'Evaluar agregar fee de limpieza para estadías cortas', completed: false },
      ],
      evidence: [
        { metric: 'Canal', value: worst.source },
        { metric: 'Reservas afectadas', value: `${worst.count}` },
        { metric: 'Pérdida por noche', value: `$${Math.abs(worst.avgProfitPerNight).toLocaleString()}` },
        { metric: 'Pérdida total', value: `$${Math.round(worst.lossAmount).toLocaleString()}` },
      ],
      priority: 3,
      isActive: true,
      triggeredAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Error checking one-night loss pattern:', e);
    return null;
  }
}

// =====================================================
// 9. Commission Override Needed - canal usa default
// Trigger: canal con >10% revenue usa comisión default
// =====================================================

function checkCommissionOverrideNeeded(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  try {
    const channelMetrics = calculateChannelMetrics(propertyId, startDateOrDays, endDate);
    const costSettings = database.getCostSettings(propertyId);
    const overrides = costSettings?.channel_commission_overrides || {};
    
    // Find channels with significant revenue using estimated commission
    const significantChannels = channelMetrics.channels.filter(c => 
      c.revenueShare > 0.1 && 
      c.isCommissionEstimated &&
      c.sourceCategory.toLowerCase() === 'ota'
    );
    
    if (significantChannels.length === 0) {
      return null;
    }
    
    const worst = significantChannels[0];
    const potentialDelta = worst.revenue * 0.03; // Assuming 3% potential error
    
    return {
      id: nanoid(),
      type: 'commission_override_needed',
      title: `Confirmá comisión de ${worst.source}`,
      description: `${worst.source} representa ${(worst.revenueShare * 100).toFixed(0)}% de tu revenue pero usa comisión estimada (${(worst.effectiveCommissionRate * 100).toFixed(0)}%). Configurá el valor real.`,
      impact: {
        value: potentialDelta,
        unit: '$/mes',
        direction: 'up',
      },
      confidence: 'medium',
      steps: [
        { text: `Verificar comisión real en contrato de ${worst.source}`, completed: false },
        { text: 'Ir a Costos > Comisiones de canal', completed: false },
        { text: `Configurar override para ${worst.source}`, completed: false },
      ],
      evidence: [
        { metric: 'Canal', value: worst.source },
        { metric: 'Revenue', value: `$${Math.round(worst.revenue).toLocaleString()}` },
        { metric: 'Comisión actual', value: `${(worst.effectiveCommissionRate * 100).toFixed(0)}% (estimada)` },
        { metric: '% del revenue', value: `${(worst.revenueShare * 100).toFixed(0)}%` },
      ],
      priority: 5,
      isActive: true,
      triggeredAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Error checking commission override:', e);
    return null;
  }
}

// =====================================================
// 10. Costs Data Gap - costos no configurados
// Trigger: low_confidence_ratio > 20% por falta de costos
// =====================================================

function checkCostsDataGap(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): RecommendedAction | null {
  try {
    const costCheck = checkCostsConfigured(propertyId);
    
    if (costCheck.isComplete) {
      return null;
    }
    
    const economics = calculateReservationEconomicsSummary(propertyId, startDateOrDays, endDate);
    
    // Only trigger if we have enough data
    if (economics.totalReservations < 5) {
      return null;
    }
    
    return {
      id: nanoid(),
      type: 'costs_data_gap',
      title: UI_COPY.actions.costs_data_gap.title,
      description: `${costCheck.issues.join('. ')}. Esto afecta la precisión del cálculo de rentabilidad.`,
      impact: {
        value: 0, // Risk-based, not monetary
        unit: '$',
        direction: 'up',
      },
      confidence: 'high',
      steps: [
        { text: 'Ir a Costos', completed: false },
        ...costCheck.issues.map(issue => ({
          text: issue.replace('no configurado', ': configurar'),
          completed: false,
        })),
      ],
      evidence: [
        { metric: 'Issues', value: `${costCheck.issues.length}` },
        { metric: 'Reservas con baja confianza', value: `${economics.lowConfidenceCount}` },
        { metric: '% baja confianza', value: `${economics.lowConfidenceShare.toFixed(1)}%` },
      ],
      priority: economics.lowConfidenceShare > 30 ? 2 : 6,
      isActive: true,
      triggeredAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Error checking costs data gap:', e);
    return null;
  }
}

// =====================================================
// Complete Action Step
// =====================================================

export function completeActionStep(propertyId: string, actionType: ActionType, stepIndex: number): void {
  database.insertActionCompletion({
    id: nanoid(),
    property_id: propertyId,
    action_type: actionType,
    step_index: stepIndex,
    completed_at: new Date().toISOString(),
  });
}

// =====================================================
// Get Completed Steps
// =====================================================

export function getCompletedSteps(propertyId: string): Record<ActionType, number[]> {
  const completions = database.getCompletedSteps(propertyId);
  
  const result: Record<string, number[]> = {};
  for (const c of completions) {
    if (!result[c.action_type]) {
      result[c.action_type] = [];
    }
    result[c.action_type].push(c.step_index);
  }
  
  return result as Record<ActionType, number[]>;
}
