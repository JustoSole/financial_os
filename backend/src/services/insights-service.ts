import database from '../db';
import { CalculationEngine } from './calculation-engine';
import { DatePeriod } from '../types';

/**
 * Insights Service - Intelligent Business Analysis
 * 
 * Ahora usa CalculationEngine directamente sin fallback para asegurar que
 * los insights correspondan al período seleccionado.
 */
export async function generateInsights(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
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
  
  // IMPORTANTE: Para insights usados en acciones, NO hacemos fallback a datos históricos
  // para evitar comparaciones incorrectas de tarifas antiguas con costos actuales.
  const engine = new CalculationEngine(propertyId, period, { disableFallback: true });
  await engine.init();
  
  const home = engine.getHomeMetrics();
  const cash = await engine.getCashMetrics();
  const channels = engine.getChannelMetrics();
  const costSettings = await database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0;
  const overrides = costSettings?.channel_commission_overrides || {};
  
  // Verificar si hay datos en el período
  const hasDataInPeriod = engine.getReservations().length > 0;
  const usedFallbackPeriod = engine.isUsingFallbackPeriod();

  const insights: any[] = [];

  // Si no hay datos en el período, retornamos un insight informativo
  if (!hasDataInPeriod) {
    return {
      summary: {
        totalInsights: 0,
        criticalCount: 0,
        highCount: 0
      },
      insights: [],
      noDataInPeriod: true,
      requestedPeriod: period,
      usedFallbackPeriod: false
    };
  }

  // 1. Savings Insight
  if (home.ahorroPotencial?.value > 0) {
    insights.push({
      type: 'savings',
      title: 'Ahorro Potencial en Comisiones',
      description: home.ahorroPotencial.suggestion || `Podés ahorrar $${home.ahorroPotencial.value.toLocaleString()} optimizando canales`,
      impact: 'high',
      value: home.ahorroPotencial.value,
      category: 'Canales'
    });
  }

  // 2. Cash Runway Insight
  if (cash?.runway?.days < 90 && cash?.runway?.days > 0) {
    insights.push({
      type: 'risk',
      title: 'Runway de Caja Limitado',
      description: `Tu saldo actual durará aproximadamente ${cash.runway.days} días con el flujo actual.`,
      impact: 'critical',
      value: cash.runway.days,
      category: 'Caja'
    });
  }

  // 3. Channel Mix Insight
  const channelData = channels?.channels || [];
  if (channelData.length > 0) {
    const totalRevenue = channelData.reduce((sum: number, c: any) => sum + c.revenue, 0);
    const otaRevenue = channelData
      .filter((c: any) => c.sourceCategory?.toLowerCase() === 'ota')
      .reduce((sum: number, c: any) => sum + c.revenue, 0);
    
    const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;
    
    if (otaShare > 70) {
      insights.push({
        type: 'dependency',
        title: 'Alta Dependencia de OTAs',
        description: `El ${otaShare.toFixed(0)}% de tus ingresos proviene de OTAs. Considerá fortalecer tus canales directos para mejorar tu margen neto.`,
        impact: 'high',
        value: otaShare,
        category: 'Canales'
      });
    }

    // Direct Channel Performance Insight
    const directRevenue = channelData
      .filter((c: any) => ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(c.source?.toLowerCase() || ''))
      .reduce((sum: number, c: any) => sum + c.revenue, 0);
    
    const directShare = totalRevenue > 0 ? (directRevenue / totalRevenue) * 100 : 0;
    if (directShare < 15 && totalRevenue > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Oportunidad en Canal Directo',
        description: `Tu venta directa es solo del ${directShare.toFixed(1)}%. Implementar un motor de reservas podría ahorrarte miles en comisiones.`,
        impact: 'medium',
        value: directShare,
        category: 'Canales'
      });
    }

    // Worst Channel Insight para acciones del frontend
    const sortedByNet = [...channelData].sort((a: any, b: any) => (a.profitPerNight || 0) - (b.profitPerNight || 0));
    const worstChannel = sortedByNet[0];
    if (worstChannel && worstChannel.effectiveCommissionRate > 0.15) {
      // Calcular el "real cost" como la diferencia de ADR con el canal directo
      const directChannel = channelData.find((c: any) => 
        ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(c.source?.toLowerCase() || '')
      );
      const directAdr = directChannel?.adr || worstChannel.adr;
      const realCostPercent = worstChannel.effectiveCommissionRate * 100;
      
      insights.push({
        type: 'channel_cost',
        worstChannel: {
          channel: worstChannel.source,
          commissionRate: worstChannel.effectiveCommissionRate,
          realCostPercent,
          adr: worstChannel.adr,
          revenue: worstChannel.revenue
        },
        directAdr: directAdr
      });
    }
  }

  // 4. Collections Insight
  const reservationsWithBalance = await database.getReservationsWithBalance(propertyId);
  const totalBalance = reservationsWithBalance.reduce((sum: number, r: any) => sum + (r.balance_due || 0), 0);
  if (totalBalance > 50000) {
    insights.push({
      type: 'collections',
      title: 'Cuentas por Cobrar Elevadas',
      description: `Tenés $${totalBalance.toLocaleString()} pendientes de cobro en ${reservationsWithBalance.length} reservas.`,
      impact: 'high',
      value: totalBalance,
      category: 'Cobranzas'
    });
  }

  return {
    summary: {
      totalInsights: insights.length,
      criticalCount: insights.filter(i => i.impact === 'critical').length,
      highCount: insights.filter(i => i.impact === 'high').length
    },
    insights,
    noDataInPeriod: false,
    requestedPeriod: period,
    usedFallbackPeriod,
    // Información adicional para acciones del frontend
    worstChannel: insights.find(i => i.type === 'channel_cost')?.worstChannel || null,
    directAdr: insights.find(i => i.type === 'channel_cost')?.directAdr || null
  };
}
