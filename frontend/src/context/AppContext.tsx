import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { getProperty, getMetrics, getActions, trackEvent } from '../api';
import { setGlobalCurrency } from '../utils/formatters';
import { useAuth } from './AuthContext';

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
  preset: 7 | 30 | 60 | 90 | 180 | 365 | null;
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
  const { session } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [actions, setActions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to prevent infinite loops and duplicate calls
  const isInitializing = useRef(false);
  const lastSessionId = useRef<string | null>(null);
  const lastPropertyId = useRef<string | null>(null);
  const lastDateRangeDays = useRef<number>(30);
  
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { preset: 30, start, end, days: 30 };
  });

  const setDateRange = useCallback((input: DateRangeInput) => {
    if (input.preset) {
      const end = new Date();
      const start = new Date(end.getTime() - input.preset * 24 * 60 * 60 * 1000);
      setDateRangeState({ preset: input.preset, start, end, days: input.preset });
    } else if (input.custom) {
      const { start, end } = input.custom;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      setDateRangeState({ preset: null, start, end, days });
    }
  }, []);

  // Stable session identifier (use access_token or user id, not the whole object)
  const sessionId = session?.access_token || null;

  const refreshProperty = useCallback(async (): Promise<Property | null> => {
    if (!session) return null;
    
    try {
      const res = await getProperty();
      if (res.success && res.data) {
        // Only update if the property actually changed
        setProperty(prev => {
          if (prev?.id === res.data.id && prev?.name === res.data.name) {
            return prev; // No change, return same reference
          }
          return res.data;
        });
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
  }, [session]);

  const refreshData = useCallback(async () => {
    if (!property || !session) return;
    
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
  }, [property?.id, dateRange.days, session]);

  // Effect 1: Initialize property when session changes
  useEffect(() => {
    // Guard: Only run if session actually changed
    if (sessionId === lastSessionId.current) return;
    lastSessionId.current = sessionId;

    async function init() {
      if (!session) {
        setProperty(null);
        setMetrics(null);
        setActions(null);
        setLoading(false);
        return;
      }

      // Prevent duplicate initialization
      if (isInitializing.current) return;
      isInitializing.current = true;

      setLoading(true);
      try {
        const res = await getProperty();
        if (res.success && res.data) {
          setProperty(res.data);
          if (res.data.currency) {
            setGlobalCurrency(res.data.currency);
          }
          // Track event only on first load
          trackEvent(res.data.id, 'view_home');
        } else {
          setError('No se pudo cargar la propiedad');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        isInitializing.current = false;
      }
    }
    init();
  }, [sessionId]); // Only depend on the stable sessionId string

  // Effect 2: Refresh data when property or dateRange changes
  useEffect(() => {
    const propertyId = property?.id || null;
    const days = dateRange.days;

    // Guard: Only run if property or dateRange actually changed
    const propertyChanged = propertyId !== lastPropertyId.current;
    const dateRangeChanged = days !== lastDateRangeDays.current;
    
    if (!propertyChanged && !dateRangeChanged) return;
    if (!propertyId || !session) return;
    
    // Update refs
    lastPropertyId.current = propertyId;
    lastDateRangeDays.current = days;

    // Skip if still initializing
    if (isInitializing.current) return;

    refreshData();
  }, [property?.id, dateRange.days, session, refreshData]);

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
