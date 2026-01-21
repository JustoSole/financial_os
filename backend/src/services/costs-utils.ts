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

export function getVariableCostPerNight(
  costSettings: any,
  occupiedNights: number,
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

  const perNightBase = occupiedNights > 0 ? monthlyVariableTotal / occupiedNights : 0;
  const cleaningPerNight = cleaningPerStay > 0
    ? (occupiedNights > 0 && totalReservations > 0
        ? (cleaningPerStay * totalReservations) / occupiedNights
        : cleaningPerStay / 3)
    : 0;

  return {
    perNightBase,
    cleaningPerNight,
    perNightTotal: perNightBase + cleaningPerNight,
    cleaningTotal: cleaningPerStay * (totalReservations || 0),
    monthlyVariableTotal,
    usesCategories,
  };
}

