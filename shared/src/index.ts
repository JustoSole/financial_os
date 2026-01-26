/**
 * =====================================================
 * Financial OS - Shared Module
 * Single source of truth for types, constants & helpers
 * =====================================================
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Helpers
export * from './helpers';

// =====================================================
// UI Copy (Spanish)
// =====================================================

export const UI_COPY = {
  metrics: {
    cobrado: {
      title: 'Cobrado',
      tooltip: 'Total de pagos recibidos en el período.',
      badge: 'Real',
    },
    cargado: {
      title: 'Cargado',
      tooltip: 'Total de cargos generados en el período.',
      badge: 'Real',
    },
    pendiente: {
      title: 'Pendiente',
      tooltip: 'Balance operativo pendiente de cobro.',
      badge: 'Real',
    },
    ahorroPotencial: {
      title: 'Ahorro potencial',
      tooltip: 'Estimación de ahorro optimizando mix de canales.',
      badge: 'Estimado',
    },
    runway: {
      title: 'Días de caja',
      tooltip: 'Cuántos días podés operar con el efectivo actual.',
      badge: 'Estimado',
    },
  },
  trust: {
    real: 'Real',
    estimado: 'Estimado',
    incompleto: 'Incompleto',
  },
  confidence: {
    high: 'Alta confianza',
    medium: 'Confianza media',
    low: 'Baja confianza',
  },
  dataHealth: {
    completos: 'Datos completos',
    parciales: 'Datos parciales',
    faltan: 'Faltan datos',
  },
  actions: {
    cash_risk: {
      title: 'Riesgo de caja',
      description: 'Tu colchón de caja es menor a 30 días.',
    },
    collections: {
      title: 'Cobranza pendiente',
      description: 'Hay reservas con saldo pendiente de cobro.',
    },
    deposit_gap: {
      title: 'Gap de depósitos',
      description: 'Algunas reservas no alcanzaron el depósito sugerido.',
    },
    ota_dependency: {
      title: 'Dependencia de OTAs',
      description: 'Más del 70% de tus ingresos vienen de OTAs.',
    },
    channel_cost: {
      title: 'Costo de canal alto',
      description: 'Tu canal más caro tiene una comisión elevada.',
    },
    data_quality: {
      title: 'Datos incompletos',
      description: 'Falta información para recomendaciones precisas.',
    },
    unprofitable_reservations: {
      title: 'Reservas no rentables',
      description: 'Tenés reservas que generan pérdida.',
    },
    one_night_loss_pattern: {
      title: 'Patrón: 1 noche genera pérdida',
      description: 'Las reservas de 1 noche en este canal no son rentables.',
    },
    commission_override_needed: {
      title: 'Comisión sin configurar',
      description: 'Un canal importante usa la comisión por defecto.',
    },
    costs_data_gap: {
      title: 'Costos incompletos',
      description: 'Faltan datos de costos para calcular rentabilidad.',
    },
  },
  import: {
    reports: {
      expanded_transactions: {
        name: 'Expanded Transaction Report with Details',
        description: 'Fuente de verdad para caja y cobros.',
        required: true,
      },
      reservations_financials: {
        name: 'Reservations with Financials',
        description: 'Unidad económica por reserva.',
        required: true,
      },
    },
  },
};
