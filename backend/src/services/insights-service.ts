import database from '../db';
import { 
  calculateHomeMetrics, 
  calculateCashMetrics, 
  calculateChannelMetrics 
} from './metrics-service';

/**
 * Insights Service - Intelligent Business Analysis
 */
export async function generateInsights(propertyId: string, startDateOrDays: string | number = 30, endDate?: string): Promise<any> {
  const home = await calculateHomeMetrics(propertyId, startDateOrDays, endDate);
  const cash = await calculateCashMetrics(propertyId, startDateOrDays, endDate);
  const channels = await calculateChannelMetrics(propertyId, startDateOrDays, endDate);
  const costSettings = await database.getCostSettings(propertyId);
  const defaultRate = costSettings?.default_ota_commission_rate || 0;
  const overrides = costSettings?.channel_commission_overrides || {};

  const insights: any[] = [];

  // 1. Savings Insight
  if (home.ahorroPotencial.value > 0) {
    insights.push({
      type: 'savings',
      title: 'Ahorro Potencial en Comisiones',
      description: home.ahorroPotencial.suggestion,
      impact: 'high',
      value: home.ahorroPotencial.value,
      category: 'Canales'
    });
  }

  // 2. Cash Runway Insight
  if (cash.runway.days < 90 && cash.runway.days > 0) {
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
  const channelData = channels.channels;
  if (channelData.length > 0) {
    const totalRevenue = channelData.reduce((sum: number, c: any) => sum + c.revenue, 0);
    const otaRevenue = channelData
      .filter((c: any) => c.sourceCategory.toLowerCase() === 'ota')
      .reduce((sum: number, c: any) => sum + c.revenue, 0);
    
    const otaShare = totalRevenue > 0 ? (otaRevenue / totalRevenue) * 100 : 0;
    
    if (otaShare > 70) {
      insights.push({
        type: 'dependency',
        title: 'Alta Dependencia de OTAs',
        description: `El ${otaShare.toFixed(0)}% de tus ingresos proviene de OTAs. Considerá fortalecer tus canales directos para mejorar tu margen neto.`,
        impact: 'high', // Increased impact for high OTA dependency
        value: otaShare,
        category: 'Canales'
      });
    }

    // New Insight: Direct Channel Performance
    const directRevenue = channelData
      .filter((c: any) => ['direct', 'walk-in', 'email', 'pagina web', 'teléfono', 'telefono', 'directo', 'website', 'phone'].includes(c.source.toLowerCase()))
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
  }

  // 4. Collections Insight
  const reservations = await database.getReservationsWithBalance(propertyId);
  const totalBalance = reservations.reduce((sum: number, r: any) => sum + (r.balance_due || 0), 0);
  if (totalBalance > 50000) {
    insights.push({
      type: 'collections',
      title: 'Cuentas por Cobrar Elevadas',
      description: `Tenés $${totalBalance.toLocaleString()} pendientes de cobro en ${reservations.length} reservas.`,
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
    insights
  };
}
