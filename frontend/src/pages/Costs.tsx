import { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle, DollarSign, Building, 
  Calculator, TrendingUp, AlertCircle, Sparkles,
  CreditCard, Globe, ChevronDown, ChevronUp,
  Plus, Trash2, Info, Zap, Calendar
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  updateCosts, getCosts, getChannelsFromPMS, trackEvent,
  ChannelCommissions, PaymentFees, PMSChannel
} from '../api';
import styles from './Costs.module.css';


// =====================================================
// NEW: Flexible Cost Categories Structure
// =====================================================

interface CostCategory {
  id: string;
  name: string;
  monthlyAmount: number;
}

interface ExtraordinaryCost {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM format
}

// Default categories (user can add/remove)
const DEFAULT_VARIABLE_CATEGORIES: CostCategory[] = [
  { id: 'laundry', name: 'Lavandería', monthlyAmount: 0 },
  { id: 'amenities', name: 'Amenities', monthlyAmount: 0 },
  { id: 'supplies', name: 'Insumos', monthlyAmount: 0 },
];

const DEFAULT_FIXED_CATEGORIES: CostCategory[] = [
  { id: 'salaries', name: 'Sueldos', monthlyAmount: 0 },
  { id: 'rent', name: 'Alquiler', monthlyAmount: 0 },
  { id: 'utilities', name: 'Servicios (luz, gas, agua)', monthlyAmount: 0 },
  { id: 'software', name: 'Software (PMS, etc)', monthlyAmount: 0 },
  { id: 'insurance', name: 'Seguros', monthlyAmount: 0 },
  { id: 'maintenance', name: 'Mantenimiento', monthlyAmount: 0 },
];

// Common OTA commission rates
const KNOWN_OTA_RATES: Record<string, number> = {
  'Booking.com': 0.15,
  'Airbnb': 0.03,
  'Expedia': 0.18,
  'VRBO': 0.08,
  'Hotels.com': 0.20,
  'Agoda': 0.18,
  'Trip.com': 0.15,
  'Despegar': 0.18,
  'Hostelworld': 0.12,
};

// Payment gateway rates
const KNOWN_PAYMENT_RATES: Record<string, number> = {
  'MercadoPago': 0.045,
  'Stripe': 0.029,
  'PayPal': 0.039,
  'Transferencia': 0,
  'Efectivo': 0,
  'Tarjeta presente': 0.025,
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Formatea un número con puntos como separadores de miles (formato español)
const formatNumberWithDots = (value: number): string => {
  if (value === 0) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Parsea un string con formato español (acepta puntos como separadores de miles)
const parseIntegerInput = (value: string) => {
  const digitsOnly = value.replace(/[^\d]/g, '');
  return digitsOnly ? Number(digitsOnly) : 0;
};

// Formatea el valor para mostrar en inputs con formato español
const formatNumericInputValue = (value: number) => formatNumberWithDots(value);

export default function Costs() {
  const { property, refreshData } = useApp();
  
  // State
  const [startingCashBalance, setStartingCashBalance] = useState(0);
  const [cleaningPerStay, setCleaningPerStay] = useState(0); // Costo de limpieza por estadía (independiente)
  const [variableCategories, setVariableCategories] = useState<CostCategory[]>(DEFAULT_VARIABLE_CATEGORIES);
  const [fixedCategories, setFixedCategories] = useState<CostCategory[]>(DEFAULT_FIXED_CATEGORIES);
  const [extraordinaryCosts, setExtraordinaryCosts] = useState<ExtraordinaryCost[]>([]);
  const [channelCommissions, setChannelCommissions] = useState<ChannelCommissions>({
    defaultRate: 0.15,
    byChannel: {},
  });
  const [paymentFees, setPaymentFees] = useState<PaymentFees>({
    enabled: true,
    defaultRate: 0.035,
    byMethod: { ...KNOWN_PAYMENT_RATES }, // Pre-populate with known rates
  });
  
  // PMS data
  const [occupiedNights, setOccupiedNights] = useState(0);
  const [totalReservations, setTotalReservations] = useState(0);
  const [pmsChannels, setPmsChannels] = useState<PMSChannel[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOTASection, setShowOTASection] = useState(true);
  const [showPaymentSection, setShowPaymentSection] = useState(true);
  const [showExtraordinarySection, setShowExtraordinarySection] = useState(true);
  
  // New category inputs
  const [newVariableName, setNewVariableName] = useState('');
  const [newFixedName, setNewFixedName] = useState('');
  const [newExtraordinaryName, setNewExtraordinaryName] = useState('');
  const [newExtraordinaryAmount, setNewExtraordinaryAmount] = useState(0);
  const [newExtraordinaryDate, setNewExtraordinaryDate] = useState(
    new Date().toISOString().slice(0, 7) // Current YYYY-MM
  );

  useEffect(() => {
    if (property) {
      loadData();
      trackEvent(property.id, 'view_costs');
    }
  }, [property]);

  const loadData = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [costsRes, channelsRes] = await Promise.all([
        getCosts(property.id),
        getChannelsFromPMS(property.id),
      ]);
      
      let loadedChannelCommissions: ChannelCommissions = { defaultRate: 0.15, byChannel: {} };
      let loadedPaymentFees: PaymentFees = { enabled: true, defaultRate: 0.035, byMethod: { ...KNOWN_PAYMENT_RATES } };
      
      if (costsRes.success && costsRes.data) {
        const data = costsRes.data;
        setStartingCashBalance(data.starting_cash_balance || 0);
        
        // Load cleaning per stay (independent from monthly variables)
        if (data.variable_costs?.cleaningPerStay !== undefined) {
          setCleaningPerStay(data.variable_costs.cleaningPerStay);
        }
        
        // Load variable categories (simplified - all monthly now)
        if (data.variable_categories && data.variable_categories.length > 0) {
          // Remove type field if present (legacy data) and filter out cleaning category
          setVariableCategories(data.variable_categories
            .filter((c: CostCategory & { type?: string }) => c.id !== 'cleaning')
            .map((c: CostCategory & { type?: string }) => ({
              id: c.id,
              name: c.name,
              monthlyAmount: c.monthlyAmount || 0
            })));
        } else if (data.variable_costs) {
          // Legacy format - convert to new format (cleaning is now separate)
          const legacyCategories: CostCategory[] = [];
          if (data.variable_costs.laundryMonthly > 0) {
            legacyCategories.push({
              id: 'laundry',
              name: 'Lavandería',
              monthlyAmount: data.variable_costs.laundryMonthly,
            });
          }
          if (data.variable_costs.amenitiesMonthly > 0) {
            legacyCategories.push({
              id: 'amenities',
              name: 'Amenities',
              monthlyAmount: data.variable_costs.amenitiesMonthly,
            });
          }
          if (legacyCategories.length > 0) {
            setVariableCategories([...DEFAULT_VARIABLE_CATEGORIES.map(c => {
              const legacy = legacyCategories.find(l => l.id === c.id);
              return legacy ? legacy : c;
            })]);
          }
        }
        
        // Load fixed categories
        if (data.fixed_categories && data.fixed_categories.length > 0) {
          setFixedCategories(data.fixed_categories.map((c: CostCategory & { type?: string }) => ({
            id: c.id,
            name: c.name,
            monthlyAmount: c.monthlyAmount || 0
          })));
        } else if (data.fixed_costs) {
          // Legacy format - convert
          const legacyFixed: CostCategory[] = [];
          if (data.fixed_costs.salaries > 0) {
            legacyFixed.push({ id: 'salaries', name: 'Sueldos', monthlyAmount: data.fixed_costs.salaries });
          }
          if (data.fixed_costs.rent > 0) {
            legacyFixed.push({ id: 'rent', name: 'Alquiler', monthlyAmount: data.fixed_costs.rent });
          }
          if (data.fixed_costs.utilities > 0) {
            legacyFixed.push({ id: 'utilities', name: 'Servicios', monthlyAmount: data.fixed_costs.utilities });
          }
          if (data.fixed_costs.other > 0) {
            legacyFixed.push({ id: 'other', name: 'Otros', monthlyAmount: data.fixed_costs.other });
          }
          if (legacyFixed.length > 0) {
            setFixedCategories([...DEFAULT_FIXED_CATEGORIES.map(c => {
              const legacy = legacyFixed.find(l => l.id === c.id);
              return legacy ? legacy : c;
            })]);
          }
        }
        
        // Load extraordinary costs
        if (data.extraordinary_costs && data.extraordinary_costs.length > 0) {
          setExtraordinaryCosts(data.extraordinary_costs);
        }
        
        // Load saved commissions
        if (data.channel_commissions) {
          loadedChannelCommissions = data.channel_commissions;
        }
        
        // Load saved payment fees, but ensure we have all known methods
        if (data.payment_fees) {
          loadedPaymentFees = {
            ...data.payment_fees,
            byMethod: {
              ...KNOWN_PAYMENT_RATES, // Base known rates
              ...data.payment_fees.byMethod // Override with saved values
            }
          };
        }
        
        // Set occupancy data
        if (data.calculated) {
          setOccupiedNights(data.calculated.occupiedNightsLastMonth || 0);
          setTotalReservations(data.calculated.totalReservationsLastMonth || 0);
        }
      }
      
      // Load PMS channels and pre-populate their rates
      if (channelsRes.success && channelsRes.data) {
        const channels = channelsRes.data;
        setPmsChannels(channels);
        
        // Pre-populate channel commissions with detected OTAs
        const prePopulatedByChannel: Record<string, number> = { ...loadedChannelCommissions.byChannel };
        channels.forEach((channel: PMSChannel) => {
          if (prePopulatedByChannel[channel.name] === undefined) {
            // Find a matching known rate
            const knownKey = Object.keys(KNOWN_OTA_RATES).find(
              k => channel.name.toLowerCase().includes(k.toLowerCase())
            );
            if (knownKey) {
              prePopulatedByChannel[channel.name] = KNOWN_OTA_RATES[knownKey];
            } else if (!isDirectChannel(channel.name)) {
              // Use default rate for non-direct channels
              prePopulatedByChannel[channel.name] = loadedChannelCommissions.defaultRate;
            }
          }
        });
        
        loadedChannelCommissions = {
          ...loadedChannelCommissions,
          byChannel: prePopulatedByChannel
        };
      }
      
      setChannelCommissions(loadedChannelCommissions);
      setPaymentFees(loadedPaymentFees);
      
    } catch (err) {
      console.error('Error loading costs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    setSaved(false);
    try {
      const updateData: any = {
        startingCashBalance,
        cleaningPerStay, // Costo de limpieza por estadía (unit economics real)
        variableCategories,
        fixedCategories,
        extraordinaryCosts,
        channelCommissions,
        paymentFees,
      };
      const res = await updateCosts(property.id, updateData);
      if (res.success) {
        setSaved(true);
        refreshData();
        trackEvent(property.id, 'costs_updated');
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving costs:', err);
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // Calculations
  // =====================================================
  
  // Total variable costs per month
  const totalVariableMonthly = useMemo(() => {
    return variableCategories.reduce((sum, cat) => sum + (cat.monthlyAmount || 0), 0);
  }, [variableCategories]);
  
  // Total fixed costs per month
  const totalFixedMonthly = useMemo(() => {
    return fixedCategories.reduce((sum, cat) => sum + (cat.monthlyAmount || 0), 0);
  }, [fixedCategories]);
  
  // Total extraordinary costs (current month)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const totalExtraordinaryCurrentMonth = useMemo(() => {
    return extraordinaryCosts
      .filter(c => c.date === currentMonth)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [extraordinaryCosts, currentMonth]);
  
  // Variable cost per night (all distributed by occupied nights now)
  const variablePerNight = useMemo(() => {
    if (occupiedNights <= 0) return 0;
    return totalVariableMonthly / occupiedNights;
  }, [totalVariableMonthly, occupiedNights]);
  
  // Fixed cost per day
  const fixedPerDay = useMemo(() => {
    return totalFixedMonthly / 30.44;
  }, [totalFixedMonthly]);
  
  // Fixed cost per occupied night
  const fixedPerNight = useMemo(() => {
    if (occupiedNights <= 0) return 0;
    return totalFixedMonthly / occupiedNights;
  }, [totalFixedMonthly, occupiedNights]);

  // Runway calculation
  const runwayDays = useMemo(() => {
    if (startingCashBalance <= 0 || totalFixedMonthly <= 0) return 0;
    return Math.round(startingCashBalance / fixedPerDay);
  }, [startingCashBalance, fixedPerDay, totalFixedMonthly]);

  // =====================================================
  // Category Management
  // =====================================================
  
  const addVariableCategory = () => {
    if (!newVariableName.trim()) return;
    setVariableCategories(prev => [...prev, {
      id: generateId(),
      name: newVariableName.trim(),
      monthlyAmount: 0,
    }]);
    setNewVariableName('');
  };
  
  const addFixedCategory = () => {
    if (!newFixedName.trim()) return;
    setFixedCategories(prev => [...prev, {
      id: generateId(),
      name: newFixedName.trim(),
      monthlyAmount: 0,
    }]);
    setNewFixedName('');
  };
  
  const updateVariableCategory = (id: string, amount: number) => {
    setVariableCategories(prev => prev.map(c => 
      c.id === id ? { ...c, monthlyAmount: amount } : c
    ));
  };
  
  const updateFixedCategory = (id: string, amount: number) => {
    setFixedCategories(prev => prev.map(c => 
      c.id === id ? { ...c, monthlyAmount: amount } : c
    ));
  };
  
  const removeVariableCategory = (id: string) => {
    setVariableCategories(prev => prev.filter(c => c.id !== id));
  };
  
  const removeFixedCategory = (id: string) => {
    setFixedCategories(prev => prev.filter(c => c.id !== id));
  };
  
  // Extraordinary costs management
  const addExtraordinaryCost = () => {
    if (!newExtraordinaryName.trim() || newExtraordinaryAmount <= 0) return;
    setExtraordinaryCosts(prev => [...prev, {
      id: generateId(),
      name: newExtraordinaryName.trim(),
      amount: newExtraordinaryAmount,
      date: newExtraordinaryDate,
    }]);
    setNewExtraordinaryName('');
    setNewExtraordinaryAmount(0);
  };
  
  const removeExtraordinaryCost = (id: string) => {
    setExtraordinaryCosts(prev => prev.filter(c => c.id !== id));
  };

  // =====================================================
  // Channel Commission Helpers
  // =====================================================
  
  const getChannelRate = (channelName: string): number => {
    if (channelCommissions.byChannel[channelName] !== undefined) {
      return channelCommissions.byChannel[channelName];
    }
    const knownKey = Object.keys(KNOWN_OTA_RATES).find(
      k => channelName.toLowerCase().includes(k.toLowerCase())
    );
    if (knownKey) return KNOWN_OTA_RATES[knownKey];
    return channelCommissions.defaultRate;
  };

  const updateChannelRate = (channelName: string, rate: number) => {
    setChannelCommissions(prev => ({
      ...prev,
      byChannel: { ...prev.byChannel, [channelName]: rate },
    }));
  };

  const getPaymentRate = (methodName: string): number => {
    if (paymentFees.byMethod[methodName] !== undefined) {
      return paymentFees.byMethod[methodName];
    }
    const knownKey = Object.keys(KNOWN_PAYMENT_RATES).find(
      k => methodName.toLowerCase().includes(k.toLowerCase())
    );
    if (knownKey) return KNOWN_PAYMENT_RATES[knownKey];
    return paymentFees.defaultRate;
  };

  const updatePaymentRate = (methodName: string, rate: number) => {
    setPaymentFees(prev => ({
      ...prev,
      byMethod: { ...prev.byMethod, [methodName]: rate },
    }));
  };

  const isDirectChannel = (name: string): boolean => {
    const directKeywords = ['direct', 'directo', 'walk-in', 'walkin', 'phone', 'telefono', 'email', 'web propia'];
    return directKeywords.some(k => name.toLowerCase().includes(k));
  };

  const currentCurrency = property?.currency || 'ARS';
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(currentCurrency === 'USD' ? 'en-US' : 'es-AR', {
      style: 'currency', currency: currentCurrency, maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className={styles.costsLoading}>
        <div className={styles.spinner} />
        <p>Cargando configuración...</p>
      </div>
    );
  }

  const hasOccupancyData = occupiedNights > 0;

  return (
    <div className={styles.costsPage}>
      {/* Header */}
      <header className={styles.costsHeader}>
        <div className={styles.headerText}>
          <h1>Configuración de Costos</h1>
          <p>Ingresá tus gastos mensuales totales — calculamos el costo por noche automáticamente</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.currencyBadge} title="Moneda detectada desde tus archivos importados">
            <DollarSign size={14} />
            <span>{currentCurrency}</span>
          </div>
          <button 
            className={`${styles.btnSave} ${saved ? styles.saved : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? <><CheckCircle size={18} /> Guardado</> : 
             saving ? 'Guardando...' : <><Save size={18} /> Guardar</>}
          </button>
        </div>
      </header>

      {/* Data Banner */}
      {hasOccupancyData ? (
        <div className={`${styles.dataBanner} ${styles.success}`}>
          <Sparkles size={18} />
          <div className={styles.bannerContent}>
            <strong>Datos del último mes</strong>
            <span className={styles.bannerStats}>
              {occupiedNights} noches ocupadas · {totalReservations} reservas · 
              ~{(occupiedNights / totalReservations).toFixed(1)} noches promedio por estadía
            </span>
          </div>
        </div>
      ) : (
        <div className={`${styles.dataBanner} ${styles.warning}`}>
          <AlertCircle size={18} />
          <div>
            <strong>Sin datos de ocupación</strong>
            <span>Importá el reporte de reservas para cálculos automáticos por noche</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Costos Variables</div>
          <div className={styles.summaryValue}>{formatCurrency(totalVariableMonthly)}<span>/mes</span></div>
          {hasOccupancyData && (
            <div className={styles.summaryBreakdown}>
              ≈ {formatCurrency(variablePerNight)}/noche ocupada
            </div>
          )}
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Costos Fijos</div>
          <div className={styles.summaryValue}>{formatCurrency(totalFixedMonthly)}<span>/mes</span></div>
          {hasOccupancyData && (
            <div className={styles.summaryBreakdown}>
              ≈ {formatCurrency(fixedPerNight)}/noche ocupada
            </div>
          )}
        </div>
        <div className={`${styles.summaryCard} ${styles.highlight}`}>
          <div className={styles.summaryLabel}>Costo Total por Noche</div>
          <div className={styles.summaryValue}>
            {hasOccupancyData 
              ? formatCurrency(variablePerNight + fixedPerNight)
              : '—'
            }
          </div>
          <div className={styles.summaryBreakdown}>
            {hasOccupancyData ? 'Base para calcular rentabilidad' : 'Importá reservas para calcular'}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Runway de Caja</div>
          <div className={styles.summaryValue}>
            {runwayDays > 0 ? `${runwayDays}` : '—'}<span>{runwayDays > 0 ? ' días' : ''}</span>
          </div>
          <div className={styles.summaryBreakdown}>
            {startingCashBalance > 0 ? `Caja: ${formatCurrency(startingCashBalance)}` : 'Ingresá saldo de caja'}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.costsGrid}>
        {/* LEFT COLUMN - Costs */}
        <div className={styles.costsColumn}>
          {/* Cash Balance */}
          <section className={styles.costCard}>
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.blue}`}><DollarSign size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Saldo de Caja Actual</h2>
                <p>Efectivo + bancos disponible hoy</p>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.bigInput}>
                <span className={styles.currencySymbol}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formatNumericInputValue(startingCashBalance)}
                  onChange={(e) => setStartingCashBalance(parseIntegerInput(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
          </section>

          {/* Cleaning Per Stay - CRITICAL for Unit Economics */}
          <section className={styles.costCard}>
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.green}`}><Sparkles size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Limpieza por Estadía</h2>
                <p>Costo fijo por cada check-out (critical para estadías cortas)</p>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.helpText} style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px' }}>
                <AlertCircle size={14} style={{ color: '#d97706' }} />
                <span style={{ color: '#92400e' }}>
                  <strong>¿Por qué es importante?</strong> Las estadías de 1 noche suelen perder dinero porque pagan el mismo costo de limpieza que una de 5 noches. Este valor se descuenta <strong>una vez por reserva</strong>, no por noche.
                </span>
              </div>
              <div className={styles.bigInput} style={{ marginTop: '16px' }}>
                <span className={styles.currencySymbol}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formatNumericInputValue(cleaningPerStay)}
                  onChange={(e) => setCleaningPerStay(parseIntegerInput(e.target.value))}
                  placeholder="0"
                />
                <span style={{ marginLeft: '8px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>/estadía</span>
              </div>
              {cleaningPerStay > 0 && hasOccupancyData && totalReservations > 0 && (
                <div className={styles.calcResult} style={{ marginTop: '12px' }}>
                  <Calculator size={14} />
                  <span>
                    {totalReservations} reservas × ${cleaningPerStay.toLocaleString()} = <strong>{formatCurrency(cleaningPerStay * totalReservations)}/mes</strong> en limpieza
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Variable Costs */}
          <section className={styles.costCard}>
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.amber}`}><TrendingUp size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Costos Variables Mensuales</h2>
                <p>Gastos mensuales que dependen de la ocupación (excl. limpieza)</p>
              </div>
              {totalVariableMonthly > 0 && (
                <div className={styles.cardTotal}>{formatCurrency(totalVariableMonthly)}<span>/mes</span></div>
              )}
            </div>
            <div className={styles.cardBody}>
              <div className={styles.helpText}>
                <Info size={14} />
                <span>Ingresá el <strong>total mensual</strong> de cada gasto. Calculamos automáticamente cuánto es por noche.</span>
              </div>
              
              <div className={styles.categoriesList}>
                {variableCategories.map((cat) => (
                  <div key={cat.id} className={styles.categoryRow}>
                    <div className={styles.categoryInfo}>
                      <span className={styles.categoryName}>{cat.name}</span>
                    </div>
                    <div className={styles.categoryInput}>
                      <div className={styles.inputCurrency}>
                        <span>$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formatNumericInputValue(cat.monthlyAmount)}
                          onChange={(e) => updateVariableCategory(cat.id, parseIntegerInput(e.target.value))}
                          placeholder="0"
                        />
                        <span className="suffix">/mes</span>
                      </div>
                      {cat.monthlyAmount > 0 && hasOccupancyData && (
                        <span className={styles.perUnit}>
                          = {formatCurrency(cat.monthlyAmount / occupiedNights)}/noche
                        </span>
                      )}
                      <button 
                        className={styles.btnRemove}
                        onClick={() => removeVariableCategory(cat.id)}
                        title="Eliminar categoría"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add new category */}
              <div className={styles.addCategory}>
                <input
                  type="text"
                  value={newVariableName}
                  onChange={(e) => setNewVariableName(e.target.value)}
                  placeholder="Nueva categoría..."
                  onKeyDown={(e) => e.key === 'Enter' && addVariableCategory()}
                />
                <button onClick={addVariableCategory} disabled={!newVariableName.trim()}>
                  <Plus size={16} /> Agregar
                </button>
              </div>

              {hasOccupancyData && totalVariableMonthly > 0 && (
                <div className={styles.calcResult}>
                  <Zap size={14} />
                  <span>
                    <strong>{formatCurrency(variablePerNight)}</strong>/noche ocupada
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Fixed Costs */}
          <section className={styles.costCard}>
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.red}`}><Building size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Costos Fijos</h2>
                <p>Gastos mensuales independientes de ocupación</p>
              </div>
              {totalFixedMonthly > 0 && (
                <div className={styles.cardTotal}>{formatCurrency(totalFixedMonthly)}<span>/mes</span></div>
              )}
            </div>
            <div className={styles.cardBody}>
              <div className={styles.helpText}>
                <Info size={14} />
                <span>Gastos que pagás todos los meses sin importar la ocupación.</span>
              </div>
              
              <div className={styles.categoriesList}>
                {fixedCategories.map((cat) => (
                  <div key={cat.id} className={styles.categoryRow}>
                    <div className={styles.categoryInfo}>
                      <span className={styles.categoryName}>{cat.name}</span>
                    </div>
                    <div className={styles.categoryInput}>
                      <div className={styles.inputCurrency}>
                        <span>$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formatNumericInputValue(cat.monthlyAmount)}
                          onChange={(e) => updateFixedCategory(cat.id, parseIntegerInput(e.target.value))}
                          placeholder="0"
                        />
                        <span className="suffix">/mes</span>
                      </div>
                      {cat.monthlyAmount > 0 && (
                        <span className={styles.perUnit}>
                          = {formatCurrency(cat.monthlyAmount / 30.44)}/día
                        </span>
                      )}
                      <button 
                        className={styles.btnRemove}
                        onClick={() => removeFixedCategory(cat.id)}
                        title="Eliminar categoría"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add new category */}
              <div className={styles.addCategory}>
                <input
                  type="text"
                  value={newFixedName}
                  onChange={(e) => setNewFixedName(e.target.value)}
                  placeholder="Nueva categoría..."
                  onKeyDown={(e) => e.key === 'Enter' && addFixedCategory()}
                />
                <button onClick={addFixedCategory} disabled={!newFixedName.trim()}>
                  <Plus size={16} /> Agregar
                </button>
              </div>

              {totalFixedMonthly > 0 && (
                <div className={styles.calcResult}>
                  <Calculator size={14} />
                  <span>
                    <strong>{formatCurrency(fixedPerDay)}</strong>/día fijo
                    {hasOccupancyData && (
                      <> · <strong>{formatCurrency(fixedPerNight)}</strong>/noche ocupada</>
                    )}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Extraordinary Costs */}
          <section className={styles.costCard}>
            <div 
              className={`${styles.cardHeader} ${styles.clickable}`}
              onClick={() => setShowExtraordinarySection(!showExtraordinarySection)}
            >
              <div className={`${styles.cardIcon} ${styles.purple}`}><Calendar size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Costos Extraordinarios</h2>
                <p>Gastos únicos o puntuales</p>
              </div>
              {totalExtraordinaryCurrentMonth > 0 && (
                <div className={styles.cardTotal}>{formatCurrency(totalExtraordinaryCurrentMonth)}<span>este mes</span></div>
              )}
              {showExtraordinarySection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            
            {showExtraordinarySection && (
              <div className={styles.cardBody}>
                <div className={styles.helpText}>
                  <Info size={14} />
                  <span>Registrá gastos únicos como reparaciones, compras de equipamiento, etc.</span>
                </div>
                
                {extraordinaryCosts.length > 0 && (
                  <div className={styles.categoriesList}>
                    {extraordinaryCosts.map((cost) => (
                      <div key={cost.id} className={styles.categoryRow}>
                        <div className={styles.categoryInfo}>
                          <span className={styles.categoryName}>{cost.name}</span>
                          <span className={styles.costDate}>{cost.date}</span>
                        </div>
                        <div className={styles.categoryInput}>
                          <span className={styles.costAmount}>{formatCurrency(cost.amount)}</span>
                          <button 
                            className={styles.btnRemove}
                            onClick={() => removeExtraordinaryCost(cost.id)}
                            title="Eliminar gasto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new extraordinary cost */}
                <div className={styles.addExtraordinary}>
                  <input
                    type="text"
                    value={newExtraordinaryName}
                    onChange={(e) => setNewExtraordinaryName(e.target.value)}
                    placeholder="Descripción del gasto..."
                    className={styles.extraordinaryNameInput}
                  />
                  <div className={styles.extraordinaryInputGroup}>
                    <div className={styles.inputCurrency}>
                      <span>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formatNumericInputValue(newExtraordinaryAmount)}
                        onChange={(e) => setNewExtraordinaryAmount(parseIntegerInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <input
                      type="month"
                      value={newExtraordinaryDate}
                      onChange={(e) => setNewExtraordinaryDate(e.target.value)}
                      className={styles.monthInput}
                    />
                    <button 
                      onClick={addExtraordinaryCost} 
                      disabled={!newExtraordinaryName.trim() || newExtraordinaryAmount <= 0}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN - Commissions */}
        <div className={styles.costsColumn}>
          {/* OTA Commissions */}
          <section className={styles.costCard}>
            <div 
              className={`${styles.cardHeader} ${styles.clickable}`}
              onClick={() => setShowOTASection(!showOTASection)}
            >
              <div className={`${styles.cardIcon} ${styles.blue}`}><Globe size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Comisiones OTA</h2>
                <p>{pmsChannels.length > 0 ? `${pmsChannels.length} canales detectados` : 'Configura tasas por canal'}</p>
              </div>
              {showOTASection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            
            {showOTASection && (
              <div className={styles.cardBody}>
                {pmsChannels.length > 0 ? (
                  <div className={styles.categoriesList}>
                    {pmsChannels.map((channel) => {
                      const isDirect = isDirectChannel(channel.name);
                      const rate = isDirect ? 0 : getChannelRate(channel.name);
                      
                      return (
                        <div key={channel.name} className={`${styles.categoryRow} ${isDirect ? styles.direct : ''}`}>
                          <div className={styles.categoryInfo}>
                            <span className={styles.categoryName}>{channel.name}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                              {channel.reservationCount} res · {formatCurrency(channel.totalRevenue)}
                            </span>
                          </div>
                          <div className={styles.categoryInput}>
                            {isDirect ? (
                              <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.45rem', borderRadius: '4px' }}>Directo</span>
                            ) : (
                              <div className={styles.inputCurrency}>
                                <input
                                  type="number"
                                  value={Math.round(rate * 1000) / 10}
                                  onChange={(e) => updateChannelRate(channel.name, Number(e.target.value) / 100)}
                                  style={{ width: '60px' }}
                                />
                                <span className="suffix">%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Globe size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.85rem' }}>Importá reservas para ver tus canales</p>
                  </div>
                )}
                
                <div className={styles.calcResult}>
                  <span>Comisión por defecto</span>
                  <div className={styles.inputCurrency}>
                    <input
                      type="number"
                      value={Math.round(channelCommissions.defaultRate * 1000) / 10}
                      onChange={(e) => setChannelCommissions(prev => ({ 
                        ...prev, 
                        defaultRate: Number(e.target.value) / 100 
                      }))}
                      style={{ width: '60px' }}
                    />
                    <span className="suffix">%</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Payment Fees */}
          <section className={styles.costCard}>
            <div 
              className={`${styles.cardHeader} ${styles.clickable}`}
              onClick={() => setShowPaymentSection(!showPaymentSection)}
            >
              <div className={`${styles.cardIcon} ${styles.green}`}><CreditCard size={18} /></div>
              <div className={styles.cardTitle}>
                <h2>Gastos de Cobranza</h2>
                <p>Comisiones de pasarelas de pago</p>
              </div>
              {showPaymentSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            
            {showPaymentSection && (
              <div className={styles.cardBody}>
                <div className={styles.categoriesList}>
                  {Object.entries(KNOWN_PAYMENT_RATES).map(([method]) => {
                    const rate = getPaymentRate(method);
                    return (
                      <div key={method} className={styles.categoryRow}>
                        <span className={styles.categoryName}>{method}</span>
                        <div className={styles.inputCurrency}>
                          <input
                            type="number"
                            value={Math.round(rate * 1000) / 10}
                            onChange={(e) => updatePaymentRate(method, Number(e.target.value) / 100)}
                            style={{ width: '60px' }}
                          />
                          <span className="suffix">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
