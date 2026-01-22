import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Lock,
  Sparkles,
  Calendar,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { 
  PeriodSelector, 
  CashForecast,
  MiniChart,
} from '../components';
import { Card, Button } from '../components/ui';
import { HeroMetric, QuickStat } from '../components';
import type { ScheduledExpense, ForecastDay } from '../components';
import { useApp } from '../context/AppContext';
import { getCashMetrics, getCollections, trackEvent } from '../api';
import { formatCurrency, formatCurrencyShort, formatDateShort } from '../utils/formatters';
import styles from './Cash.module.css';

// Plan types (MVP: free or pro)
type PlanType = 'free' | 'pro';

// Simple plan check helper
function isPlanFeatureAvailable(plan: PlanType, feature: 'forecast' | 'exports' | 'alerts'): boolean {
  if (plan === 'pro') return true;
  if (feature === 'alerts') return true; // free has alerts
  return false;
}

export default function Cash() {
  const { property, dateRange } = useApp();
  const [cashData, setCashData] = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Local storage for scheduled expenses (until backend is ready)
  const [scheduledExpenses, setScheduledExpenses] = useState<ScheduledExpense[]>(() => {
    const saved = localStorage.getItem(`expenses_${property?.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Map legacy 'paid' plan to 'pro'
  const currentPlan: PlanType = property?.plan === 'paid' ? 'pro' : (property?.plan as PlanType) || 'free';
  const hasForecastAccess = isPlanFeatureAvailable(currentPlan, 'forecast');

  useEffect(() => {
    if (property) {
      loadData();
      trackEvent(property.id, 'view_cash');
    }
  }, [property, dateRange]);

  useEffect(() => {
    if (property?.id) {
      localStorage.setItem(`expenses_${property.id}`, JSON.stringify(scheduledExpenses));
    }
  }, [scheduledExpenses, property?.id]);

  const loadData = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const [cashRes, collectionsRes] = await Promise.all([
        getCashMetrics(property.id, dateRange.days),
        getCollections(property.id),
      ]);
      if (cashRes.success) setCashData(cashRes.data);
      if (collectionsRes.success) setCollections(collectionsRes.data);
    } catch (err) {
      console.error('Error loading cash data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate forecast data
  const forecastData = useMemo((): ForecastDay[] => {
    if (!cashData?.dailyFlow) return [];

    // Calculate average daily flow from historical data
    const avgDailyIn = cashData.dailyFlow.reduce((sum: number, d: any) => sum + d.credits, 0) / cashData.dailyFlow.length;
    const avgDailyOut = cashData.dailyFlow.reduce((sum: number, d: any) => sum + d.debits, 0) / cashData.dailyFlow.length;

    let balance = cashData.runway?.startingBalance || 0;
    const today = new Date();
    const forecast: ForecastDay[] = [];

    for (let i = 0; i < 28; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Get scheduled expenses for this day
      const dayExpenses = scheduledExpenses.filter(e => e.dueDate === dateStr);
      const scheduledOut = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Expected collections from pending reservations
      const expectedIn = collections?.reservationsWithBalance?.reduce((sum: number, r: any) => {
        const checkIn = new Date(r.checkIn);
        if (checkIn.toDateString() === date.toDateString()) {
          return sum + r.balanceDue;
        }
        return sum;
      }, 0) || 0;

      const inflows = avgDailyIn + expectedIn;
      const outflows = avgDailyOut + scheduledOut;
      balance = balance + inflows - outflows;

      forecast.push({
        date: dateStr,
        inflows,
        outflows,
        balance,
        scheduledExpenses: dayExpenses,
        expectedCollections: expectedIn,
      });
    }

    return forecast;
  }, [cashData, collections, scheduledExpenses]);

  // Chart data for daily flow
  const flowChartData = useMemo(() => {
    if (!cashData?.dailyFlow) return [];
    return cashData.dailyFlow.slice(-7).map((day: any) => ({
      value: day.netFlow,
      label: formatDateShort(day.date),
    }));
  }, [cashData]);

  const getRunwayStatus = () => {
    if (!cashData?.runway) return 'unknown';
    if (cashData.runway.days === 999) return 'excellent';
    if (cashData.runway.days >= 60) return 'good';
    if (cashData.runway.days >= 30) return 'warning';
    return 'danger';
  };

  const status = getRunwayStatus();

  const statusConfig: Record<string, { icon: any; title: string; subtitle: string; color: string }> = {
    excellent: {
      icon: CheckCircle,
      title: 'Flujo positivo',
      subtitle: 'Tu operación genera más de lo que gasta',
      color: 'positive',
    },
    good: {
      icon: TrendingUp,
      title: 'Buen colchón',
      subtitle: 'Tenés suficiente runway para operar',
      color: 'positive',
    },
    warning: {
      icon: AlertTriangle,
      title: 'Atención requerida',
      subtitle: 'Revisá cobros pendientes y egresos',
      color: 'warning',
    },
    danger: {
      icon: AlertCircle,
      title: 'Riesgo de liquidez',
      subtitle: 'Acelerá cobranza urgente',
      color: 'negative',
    },
    unknown: {
      icon: Wallet,
      title: 'Configurá tu caja',
      subtitle: 'Agregá el saldo inicial en Costos',
      color: 'neutral',
    },
  };

  const config = statusConfig[status];

  const handleAddExpense = (expense: Omit<ScheduledExpense, 'id'>) => {
    const newExpense: ScheduledExpense = {
      ...expense,
      id: Date.now().toString(),
    };
    setScheduledExpenses(prev => [...prev, newExpense]);
    setShowAddExpense(false);
  };

  // Free plan upgrade screen
  if (!hasForecastAccess) {
    return (
      <div className={styles.page}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Flujo de Caja</h1>
            <p className="page-subtitle">Proyección de tu efectivo</p>
          </div>
        </div>

        <div className="cash-upgrade">
          <div className="cash-upgrade__card">
            <div className="cash-upgrade__icon">
              <Lock size={32} />
            </div>
            <h2>Proyección de caja</h2>
            <p>
              Entendé cuántos días de operación tenés cubiertos y anticipate a problemas de liquidez.
            </p>

            <div className="cash-upgrade__features">
              <div className="cash-upgrade__feature">
                <Calendar size={18} />
                <span>Días de runway</span>
              </div>
              <div className="cash-upgrade__feature">
                <TrendingUp size={18} />
                <span>Flujo diario proyectado</span>
              </div>
              <div className="cash-upgrade__feature">
                <AlertTriangle size={18} />
                <span>Alertas predictivas</span>
              </div>
              <div className="cash-upgrade__feature">
                <CreditCard size={18} />
                <span>Egresos programados</span>
              </div>
            </div>

            <Link to="/configuracion" className="btn btn-primary btn-lg">
              <Sparkles size={18} />
              Ver planes
            </Link>
          </div>

          {/* Sample preview */}
          <div className="cash-upgrade__preview">
            <div className="cash-preview-card">
              <span className="cash-preview-label">Vista previa</span>
              <div className="cash-preview-metric">
                <span className="value">45</span>
                <span className="unit">días</span>
              </div>
              <span className="cash-preview-hint">de runway proyectado</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Flujo de Caja</h1>
          <p className="page-subtitle">Proyección basada en los últimos {dateRange.days} días</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Actualizar
          </Button>
          <PeriodSelector />
        </div>
      </div>

      {/* Hero: Runway Days */}
      <section className={styles.hero}>
        <HeroMetric
          title="Runway"
          value={cashData?.runway?.days === 999 ? 999 : (cashData?.runway?.days || 0)}
          format="days"
          status={status === 'excellent' || status === 'good' ? 'positive' : 
                  status === 'warning' ? 'warning' : 
                  status === 'danger' ? 'negative' : 'neutral'}
          subtitle={config.subtitle}
          icon={<config.icon size={20} />}
          tooltip="Días que tu caja cubre los egresos actuales"
        />
      </section>

      {/* Quick Stats */}
      {cashData?.runway && !loading && (
        <section className={styles.stats}>
          <QuickStat
            label="Saldo inicial"
            value={cashData.runway.startingBalance}
            format="currency"
            icon={<Wallet size={16} />}
            tooltip="Configurado en Costos"
          />
          <QuickStat
            label="Flujo neto/día"
            value={cashData.runway.avgNetDaily}
            format="currency"
            icon={cashData.runway.avgNetDaily >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            variant={cashData.runway.avgNetDaily >= 0 ? 'success' : 'danger'}
          />
          <QuickStat
            label="Por cobrar"
            value={collections?.totalBalanceDue || 0}
            format="currency"
            icon={<CreditCard size={16} />}
            tooltip="Saldos pendientes de reservas futuras"
          />
          <QuickStat
            label="Días activos"
            value={cashData.dailyFlow?.length || 0}
            format="number"
            icon={<Calendar size={16} />}
          />
        </section>
      )}

      {/* Forecast Section */}
      {forecastData.length > 0 && (
        <section className={styles.forecast}>
          <CashForecast
            currentBalance={cashData?.runway?.startingBalance || 0}
            forecast={forecastData}
            scheduledExpenses={scheduledExpenses}
            onAddExpense={() => setShowAddExpense(true)}
          />
        </section>
      )}

      {/* Daily Flow Chart */}
      {cashData?.dailyFlow && cashData.dailyFlow.length > 0 && (
        <section className={styles.flow}>
          <SectionHeader title="Flujo últimos 7 días" />
          <Card className={styles.flowCard} padding="none">
            <div className={styles.flowChart}>
              <MiniChart
                data={flowChartData}
                type="bar"
                color={cashData.runway.avgNetDaily >= 0 ? 'success' : 'error'}
                height={80}
                showLabels
              />
            </div>
            <div className={styles.flowList}>
              {cashData.dailyFlow.slice(-7).reverse().map((day: any) => (
                <div key={day.date} className={styles.flowRow}>
                  <span className={styles.flowDate}>
                    {formatDateShort(day.date)}
                  </span>
                  <div className={styles.flowAmounts}>
                    <span className={styles.cashIn}>+{formatCurrencyShort(day.credits)}</span>
                    <span className={styles.cashOut}>-{formatCurrencyShort(day.debits)}</span>
                  </div>
                  <span className={`${styles.flowNet} ${day.netFlow >= 0 ? styles.positive : styles.negative}`}>
                    {day.netFlow >= 0 ? '+' : ''}{formatCurrencyShort(day.netFlow)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Alerts */}
      {cashData?.alerts && cashData.alerts.length > 0 && (
        <section className={styles.alerts}>
          <SectionHeader title="Alertas" icon={<AlertTriangle size={18} />} />
          <div className={styles.alertsList}>
            {cashData.alerts.map((alert: any, i: number) => (
              <div key={i} className={styles.alert}>
                <AlertCircle size={18} />
                <div className={styles.alertContent}>
                  <strong>{alert.description}</strong>
                  <span>{formatCurrency(alert.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collections Preview */}
      {collections?.reservationsWithBalance && collections.reservationsWithBalance.length > 0 && (
        <section className={styles.collections}>
          <SectionHeader
            title="Próximos cobros"
            linkTo="/acciones"
            linkLabel="Ver todos"
          />
          <Card padding="none">
            <div className={styles.collectionsList}>
              {collections.reservationsWithBalance.slice(0, 5).map((r: any) => (
                <div key={r.reservationNumber} className={styles.collectionRow}>
                  <div className={styles.collectionInfo}>
                    <span className={styles.collectionGuest}>{r.guestName || r.reservationNumber}</span>
                    <span className={styles.collectionDate}>Check-in: {formatDateShort(r.checkIn)}</span>
                  </div>
                  <span className={styles.collectionAmount}>{formatCurrency(r.balanceDue)}</span>
                </div>
              ))}
            </div>
            <Link to="/acciones" className={styles.collectionsLink}>
              Ver todas las cobranzas
              <ChevronRight size={16} />
            </Link>
          </Card>
        </section>
      )}

      {/* Info Card */}
      <Card className={styles.infoCard}>
        <div className={styles.infoContent}>
          <AlertCircle size={18} />
          <div>
            <strong>Sobre esta proyección</strong>
            <p>
              Basada en el Expanded Transaction Report y el saldo inicial configurado en Costos.
              Agregá tus egresos programados para mayor precisión.
            </p>
          </div>
        </div>
        <Link to="/costos">
          <Button variant="secondary" size="sm" icon={<ArrowRight size={14} />} iconPosition="right">
            Ajustar costos
          </Button>
        </Link>
      </Card>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onAdd={handleAddExpense}
        />
      )}
    </div>
  );
}


// =====================================================
// Sub-Components
// =====================================================

function SectionHeader({
  title,
  icon,
  linkTo,
  linkLabel,
}: {
  title: string;
  icon?: React.ReactNode;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-header section-header--simple">
      <div className="section-header__left">
        {icon && <span className="section-header__icon">{icon}</span>}
        <h3 className="section-header__title">{title}</h3>
      </div>
      {linkTo && (
        <Link to={linkTo} className="section-header__link">
          {linkLabel} <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function AddExpenseModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (expense: Omit<ScheduledExpense, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<ScheduledExpense['category']>('otro');
  const [recurring, setRecurring] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !dueDate) return;

    onAdd({
      name,
      amount: parseFloat(amount),
      dueDate,
      category,
      recurring,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Agregar egreso programado</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body">
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Sueldos enero"
              required
            />
          </div>
          <div className="form-group">
            <label>Monto</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div className="form-group">
            <label>Fecha de pago</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value as any)}>
              <option value="sueldos">Sueldos</option>
              <option value="servicios">Servicios</option>
              <option value="impuestos">Impuestos</option>
              <option value="proveedores">Proveedores</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="form-group form-group--checkbox">
            <label>
              <input
                type="checkbox"
                checked={recurring}
                onChange={e => setRecurring(e.target.checked)}
              />
              Recurrente mensual
            </label>
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
