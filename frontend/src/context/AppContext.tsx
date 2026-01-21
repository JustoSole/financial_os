import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProperty, getMetrics, getActions, trackEvent } from '../api';
import { setGlobalCurrency } from '../utils/formatters';

interface Property {
  id: string;
  name: string;
  currency: string;
  timezone?: string;
  plan: string;
}

interface DateRange {
  preset: number | null; // 7, 30, 90 or null for custom
  start: Date;
  end: Date;
  days: number;
}

interface DateRangeInput {
  preset: 7 | 30 | 90 | null;
  custom?: { start: Date; end: Date };
}

interface AppContextType {
  property: Property | null;
  metrics: any | null;
  actions: any[] | null;
  loading: boolean;
  error: string | null;
  dateRange: DateRange;
  setDateRange: (input: DateRangeInput) => void;
  refreshData: () => Promise<void>;
  refreshProperty: () => Promise<Property | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [actions, setActions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { preset: 30, start, end, days: 30 };
  });

  const setDateRange = (input: DateRangeInput) => {
    if (input.preset) {
      const end = new Date();
      const start = new Date(end.getTime() - input.preset * 24 * 60 * 60 * 1000);
      setDateRangeState({ preset: input.preset, start, end, days: input.preset });
    } else if (input.custom) {
      const { start, end } = input.custom;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      setDateRangeState({ preset: null, start, end, days });
    }
  };

  const refreshProperty = async (): Promise<Property | null> => {
    try {
      const res = await getProperty();
      if (res.success && res.data) {
        setProperty(res.data);
        if (res.data.currency) {
          setGlobalCurrency(res.data.currency);
        }
        return res.data;
      } else {
        setError('No se pudo cargar la propiedad');
      }
    } catch (err: any) {
      setError(err.message);
    }
    return null;
  };

  const refreshData = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const startStr = dateRange.start.toISOString().substring(0, 10);
      const endStr = dateRange.end.toISOString().substring(0, 10);

      const [metricsRes, actionsRes] = await Promise.all([
        getMetrics(property.id, startStr, endStr),
        getActions(property.id),
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (actionsRes.success) setActions(actionsRes.data || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const loadedProperty = await refreshProperty();
        if (loadedProperty?.id) {
          trackEvent(loadedProperty.id, 'view_home');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (property) {
      refreshData();
    }
  }, [property, dateRange]);

  return (
    <AppContext.Provider
      value={{
        property,
        metrics,
        actions,
        loading,
        error,
        dateRange,
        setDateRange,
        refreshData,
        refreshProperty,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

