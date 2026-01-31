export interface VariableCostPerNight {
  perNightBase: number;
  cleaningPerNight: number;
  perNightTotal: number;
  cleaningTotal: number;
  monthlyVariableTotal: number;
  usesCategories: boolean;
}

function sumMonthlyVariableCategories(costSettings: any): number {
  if (!Array.isArray(costSettings?.variable_categories)) return 0;
  return costSettings.variable_categories.reduce(
    (sum: number, cat: any) => sum + (cat?.monthlyAmount || 0),
    0
  );
}

/**
 * Calcula el costo variable por noche.
 * 
 * IMPORTANTE: Este cálculo usa los "nightsForCalculation" como divisor.
 * Para cálculos de PUNTO DE EQUILIBRIO, pasa la CAPACIDAD (roomCount × días)
 * para obtener un costo estable. Para cálculos de COSTOS REALES de reservaciones
 * específicas, pasa las noches reales.
 * 
 * @param costSettings - Configuración de costos del property
 * @param nightsForCalculation - Noches para dividir costos mensuales (usar CAPACIDAD para equilibrio)
 * @param totalReservations - Número de reservaciones (para calcular limpieza por estadía)
 */
export function getVariableCostPerNight(
  costSettings: any,
  nightsForCalculation: number,
  totalReservations: number
): VariableCostPerNight {
  const usesCategories = Array.isArray(costSettings?.variable_categories) && costSettings.variable_categories.length > 0;

  const legacyCosts = costSettings?.variable_costs || {
    cleaningPerStay: 0,
    laundryMonthly: 0,
    amenitiesMonthly: 0,
  };

  const monthlyVariableTotal = usesCategories
    ? sumMonthlyVariableCategories(costSettings)
    : (legacyCosts.laundryMonthly || 0) + (legacyCosts.amenitiesMonthly || 0);

  const cleaningPerStay = usesCategories ? 0 : (legacyCosts.cleaningPerStay || 0);

  // Usar nightsForCalculation como divisor - el caller decide si es capacidad o noches reales
  // Si es 0, usamos un fallback razonable (30 noches = ~1 habitación por mes)
  const safeNights = nightsForCalculation > 0 ? nightsForCalculation : 30;
  const perNightBase = monthlyVariableTotal / safeNights;
  
  // Para limpieza por estadía, calculamos el costo por noche basado en estadía promedio
  // Si no hay datos de reservaciones, asumimos estadía promedio de 2.5 noches
  const avgStayLength = (nightsForCalculation > 0 && totalReservations > 0)
    ? nightsForCalculation / totalReservations
    : 2.5;
  const cleaningPerNight = cleaningPerStay > 0 ? cleaningPerStay / avgStayLength : 0;

  return {
    perNightBase,
    cleaningPerNight,
    perNightTotal: perNightBase + cleaningPerNight,
    cleaningTotal: cleaningPerStay * (totalReservations || 0),
    monthlyVariableTotal,
    usesCategories,
  };
}

