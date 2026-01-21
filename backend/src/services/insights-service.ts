import database from '../db';
import cacheService from './cache-service';
import { DEFAULT_CHANNEL_COMMISSIONS } from '../types';

// =====================================================
// Insights Service - Intelligence Engine
// Genera insights accionables basados en data REAL
// =====================================================

export interface ChannelInsight {
  channel: string;
  category: string;
  revenue: number;
  nights: number;
  adr: number;
  commissionRate: number;
  commissionAmount: number;
  adrNet: number;  // ADR después de comisión
  realCostPercent: number;  // Costo real vs canal directo
  revenueShare: number;
}

export interface TopInsight {
  type: 'positive' | 'warning' | 'critical';
  title: string;
  description: string;
  value: number;
  valueLabel: string;
  action?: string;
  evidence: { label: string; value: string }[];
}

export interface InsightsSummary {
  // Key metrics
  totalRevenue: number;
  totalNights: number;
  avgAdr: number;
  directShare: number;
  otaShare: number;
  
  // Channel analysis
  channels: ChannelInsight[];
  bestChannel: ChannelInsight | null;
  worstChannel: ChannelInsight | null;
  
  // Top insights (máx 3 para Home)
  topInsights: TopInsight[];
  
  // Money metrics
  totalCommissions: number;
  potentialSavings: number;
  directAdr: number;
  
  // Collections
  pendingCollection: number;
  reservationsWithBalance: number;
  urgentCollections: number;
}

// =====================================================
// Main Function: Generate All Insights
// =====================================================

export function generateInsights(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): InsightsSummary {
  const cacheKey = `insights-${propertyId}-${startDateOrDays}-${endDate || ''}`;
  const cached = cacheService.get<InsightsSummary>(cacheKey);
  if (cached) return cached;

  const costSettings = database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0.15;
  const overrides = costSettings?.channel_commission_overrides || {};
  
  // Get date range
  let startStr: string;
  let endStr: string;
  let days: number;

  if (typeof startDateOrDays === 'string' && endDate) {
    startStr = startDateOrDays;
    endStr = endDate;
    const start = new Date(startStr);
    const end = new Date(endStr);
    days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  } else {
    days = typeof startDateOrDays === 'number' ? startDateOrDays : 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    startStr = start.toISOString().substring(0, 10);
    endStr = end.toISOString().substring(0, 10);
  }
  
  const channelDataFromReservations = database.getChannelSummaryFromReservations(propertyId, startStr, endStr);
  const staticChannelData = database.getChannelSummary(propertyId);
  
  // Use reservation data if available, otherwise fall back to static
  const channelData = channelDataFromReservations.length > 0 
    ? channelDataFromReservations 
    : staticChannelData;
  
  // Calculate totals
  const totalRevenue = channelData.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const totalNights = channelData.reduce((sum, c) => sum + c.room_nights, 0);
  const avgAdr = totalNights > 0 ? totalRevenue / totalNights : 0;
  
  // Identify direct channels
  const directSources = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'direct', 'website', 'phone'];
  
  // Calculate Direct ADR as baseline
  const directChannels = channelData.filter(c => 
    directSources.includes(c.source.toLowerCase()) ||
    c.source_category?.toLowerCase() === 'direct'
  );
  const directRevenue = directChannels.reduce((sum, c) => sum + c.room_revenue_total, 0);
  const directNights = directChannels.reduce((sum, c) => sum + c.room_nights, 0);
  const directAdr = directNights > 0 ? directRevenue / directNights : avgAdr;
  
  // Calculate OTA share
  const otaChannels = channelData.filter(c => c.source_category?.toLowerCase() === 'ota');
  const otaRevenue = otaChannels.reduce((sum, c) => sum + c.room_revenue_total, 0);
  
  const directShare = totalRevenue > 0 ? directRevenue / totalRevenue : 0;
  const otaShare = totalRevenue > 0 ? otaRevenue / totalRevenue : 0;
  
  // Build channel insights with real calculations
  let totalCommissions = 0;
  const channels: ChannelInsight[] = channelData.map(ch => {
    const channelLower = ch.source.toLowerCase();
    const isDirect = directSources.includes(channelLower) || 
      ch.source_category?.toLowerCase() === 'direct';
    
    // Get commission rate
    let commissionRate = isDirect ? 0 : (
      overrides[channelLower] || 
      DEFAULT_CHANNEL_COMMISSIONS[channelLower] || 
      defaultRate
    );
    
    const adr = ch.room_nights > 0 ? ch.room_revenue_total / ch.room_nights : 0;
    const commissionAmount = ch.room_revenue_total * commissionRate;
    const adrNet = adr * (1 - commissionRate);
    
    totalCommissions += commissionAmount;
    
    // Calculate "real cost" vs direct
    // UNBIASED: If ADR is HIGHER than direct, it reduces the effective cost.
    let realCostPercent = commissionRate * 100;
    if (directAdr > 0 && adr > 0 && !isDirect) {
      const adrGapPercent = ((directAdr - adr) / directAdr) * 100;
      realCostPercent += adrGapPercent;
    }
    
    return {
      channel: ch.source,
      category: ch.source_category || categorizeSource(ch.source),
      revenue: ch.room_revenue_total,
      nights: ch.room_nights,
      adr: Math.round(adr),
      commissionRate,
      commissionAmount: Math.round(commissionAmount),
      adrNet: Math.round(adrNet),
      realCostPercent: Math.round(realCostPercent * 10) / 10,
      revenueShare: totalRevenue > 0 ? ch.room_revenue_total / totalRevenue : 0,
    };
  });
  
  // Find best and worst channels (minimum 5% share)
  const significantChannels = channels
    .filter(c => c.revenueShare > 0.05 && c.nights > 0)
    .sort((a, b) => b.adrNet - a.adrNet);
  
  const bestChannel = significantChannels[0] || null;
  const worstChannel = significantChannels[significantChannels.length - 1] || null;
  
  // Calculate potential savings (if 10% of worst channel moves to direct)
  let potentialSavings = 0;
  if (worstChannel && worstChannel.realCostPercent > 10) {
    const revenueToMove = worstChannel.revenue * 0.1;
    potentialSavings = revenueToMove * (worstChannel.commissionRate);
    // Add ADR gain
    if (worstChannel.adr < directAdr) {
      const adrGain = (directAdr - worstChannel.adr) * (worstChannel.nights * 0.1);
      potentialSavings += adrGain;
    }
  }
  
  // Get collections data
  const reservationsWithBalance = database.getReservationsWithBalance(propertyId);
  const pendingCollection = reservationsWithBalance.reduce((sum, r) => sum + r.balance_due, 0);
  const urgentCollections = reservationsWithBalance.filter(r => {
    const checkIn = new Date(r.check_in);
    const today = new Date();
    const daysUntil = (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 7 && r.balance_due > 50000;
  }).length;
  
  // Generate top insights
  const topInsights = generateTopInsights({
    totalRevenue,
    directShare,
    otaShare,
    totalCommissions,
    potentialSavings,
    pendingCollection,
    urgentCollections,
    bestChannel,
    worstChannel,
    directAdr,
    avgAdr,
  });
  
  const result: InsightsSummary = {
    totalRevenue,
    totalNights,
    avgAdr: Math.round(avgAdr),
    directShare,
    otaShare,
    channels,
    bestChannel,
    worstChannel,
    topInsights,
    totalCommissions: Math.round(totalCommissions),
    potentialSavings: Math.round(potentialSavings),
    directAdr: Math.round(directAdr),
    pendingCollection,
    reservationsWithBalance: reservationsWithBalance.length,
    urgentCollections,
  };

  cacheService.set(cacheKey, result);
  return result;
}

// =====================================================
// Generate Top 3 Insights (Priority Ordered)
// =====================================================

interface InsightInputs {
  totalRevenue: number;
  directShare: number;
  otaShare: number;
  totalCommissions: number;
  potentialSavings: number;
  pendingCollection: number;
  urgentCollections: number;
  bestChannel: ChannelInsight | null;
  worstChannel: ChannelInsight | null;
  directAdr: number;
  avgAdr: number;
}

function generateTopInsights(inputs: InsightInputs): TopInsight[] {
  const insights: TopInsight[] = [];
  
  // 1. Urgent Collections (Priority 1)
  if (inputs.urgentCollections > 0 && inputs.pendingCollection > 100000) {
    insights.push({
      type: 'critical',
      title: 'Cobranza urgente pendiente',
      description: `Tenés ${inputs.urgentCollections} reservas con check-in en los próximos 7 días que no pagaron completo.`,
      value: inputs.pendingCollection,
      valueLabel: 'pendiente de cobro',
      action: 'Contactar ahora',
      evidence: [
        { label: 'Reservas con saldo', value: `${inputs.urgentCollections}` },
        { label: 'Monto pendiente', value: formatCurrency(inputs.pendingCollection) },
      ],
    });
  }
  
  // 2. Expensive Channel Alert (Priority 2)
  if (inputs.worstChannel && inputs.worstChannel.realCostPercent > 15) {
    const adrGap = inputs.directAdr - inputs.worstChannel.adr;
    insights.push({
      type: 'warning',
      title: `${inputs.worstChannel.channel} te está costando ${inputs.worstChannel.realCostPercent.toFixed(0)}%`,
      description: adrGap > 0 
        ? `Comisión ${(inputs.worstChannel.commissionRate * 100).toFixed(0)}% + ADR $${formatNumber(adrGap)} más bajo que directo`
        : `Comisión del ${(inputs.worstChannel.commissionRate * 100).toFixed(0)}% sobre ${formatCurrency(inputs.worstChannel.revenue)}`,
      value: inputs.worstChannel.commissionAmount,
      valueLabel: 'en comisiones',
      action: 'Ver cómo optimizar',
      evidence: [
        { label: 'Comisión', value: `${(inputs.worstChannel.commissionRate * 100).toFixed(0)}%` },
        { label: 'ADR neto', value: formatCurrency(inputs.worstChannel.adrNet) },
        { label: 'ADR directo', value: formatCurrency(inputs.directAdr) },
      ],
    });
  }
  
  // 3. Direct Channel Celebration (Priority 3 - positive)
  if (inputs.directShare > 0.5) {
    insights.push({
      type: 'positive',
      title: `¡${(inputs.directShare * 100).toFixed(0)}% de ingresos son directos!`,
      description: `Estás ahorrando ${formatCurrency(inputs.directShare * inputs.totalRevenue * 0.15)} vs si todo fuera por OTAs.`,
      value: inputs.directShare * 100,
      valueLabel: '% directo',
      evidence: [
        { label: 'Ingresos directos', value: formatCurrency(inputs.directShare * inputs.totalRevenue) },
        { label: 'Comisiones OTA evitadas', value: formatCurrency(inputs.directShare * inputs.totalRevenue * 0.15) },
      ],
    });
  } else if (inputs.otaShare > 0.6) {
    // OTA dependency warning
    insights.push({
      type: 'warning',
      title: `${(inputs.otaShare * 100).toFixed(0)}% de ingresos vienen de OTAs`,
      description: `Estás pagando ~${formatCurrency(inputs.totalCommissions)} en comisiones. Aumentar reserva directa te ahorraría dinero.`,
      value: inputs.totalCommissions,
      valueLabel: 'en comisiones',
      action: 'Ver estrategias',
      evidence: [
        { label: 'Revenue OTA', value: formatCurrency(inputs.otaShare * inputs.totalRevenue) },
        { label: 'Revenue directo', value: formatCurrency(inputs.directShare * inputs.totalRevenue) },
      ],
    });
  }
  
  // 4. Savings Opportunity (Priority 4)
  if (inputs.potentialSavings > 50000 && insights.length < 3) {
    insights.push({
      type: 'positive',
      title: `Podrías ahorrar ${formatCurrency(inputs.potentialSavings)}/mes`,
      description: `Moviendo 10% de ${inputs.worstChannel?.channel || 'OTAs'} a reserva directa`,
      value: inputs.potentialSavings,
      valueLabel: 'ahorro potencial',
      action: 'Ver cómo',
      evidence: [
        { label: 'Canal más caro', value: inputs.worstChannel?.channel || '-' },
        { label: 'Costo real', value: `${inputs.worstChannel?.realCostPercent.toFixed(0)}%` },
      ],
    });
  }
  
  // 5. Best Channel Highlight (Priority 5)
  if (inputs.bestChannel && insights.length < 3) {
    insights.push({
      type: 'positive',
      title: `${inputs.bestChannel.channel} es tu canal más rentable`,
      description: `ADR neto de ${formatCurrency(inputs.bestChannel.adrNet)} - ${inputs.bestChannel.category === 'Direct' ? 'Sin comisión' : `solo ${(inputs.bestChannel.commissionRate * 100).toFixed(0)}% comisión`}`,
      value: inputs.bestChannel.adrNet,
      valueLabel: 'ADR neto',
      evidence: [
        { label: 'Noches vendidas', value: `${inputs.bestChannel.nights}` },
        { label: 'Revenue', value: formatCurrency(inputs.bestChannel.revenue) },
      ],
    });
  }
  
  return insights.slice(0, 3);
}

// =====================================================
// Helper: Categorize source
// =====================================================

function categorizeSource(source: string): string {
  const sourceLower = source.toLowerCase();
  
  const directSources = ['walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'website', 'phone', 'direct'];
  if (directSources.includes(sourceLower)) return 'Direct';
  
  const otaSources = ['booking.com', 'booking', 'expedia', 'despegar', 'decolar', 'despegar/decolar', 
                      'airbnb', 'hotels.com', 'agoda', 'tripadvisor'];
  if (otaSources.some(ota => sourceLower.includes(ota))) return 'OTA';
  
  if (sourceLower.includes('agencia') || sourceLower.includes('viajes') || 
      sourceLower.includes('travel') || sourceLower.includes('agency')) return 'Agencia de Viajes';
  
  return 'Otro';
}

// =====================================================
// Formatting helpers
// =====================================================

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return Math.round(value).toLocaleString();
}

export default { generateInsights };

