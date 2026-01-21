import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import styles from './CashForecast.module.css';

export interface ScheduledExpense {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: 'sueldos' | 'servicios' | 'impuestos' | 'proveedores' | 'otro';
  recurring?: boolean;
}

export interface ForecastDay {
  date: string;
  inflows: number;
  outflows: number;
  balance: number;
  scheduledExpenses: ScheduledExpense[];
  expectedCollections: number;
}

export interface CashForecastProps {
  currentBalance: number;
  forecast: ForecastDay[];
  scheduledExpenses: ScheduledExpense[];
  onAddExpense?: () => void;
}

export function CashForecast({
  currentBalance,
  forecast,
  scheduledExpenses,
  onAddExpense,
}: CashForecastProps) {
  // Find critical days (where balance goes negative or very low)
  const criticalDays = useMemo(() => {
    return forecast.filter(day => day.balance < 0 || day.balance < currentBalance * 0.1);
  }, [forecast, currentBalance]);

  // Group forecast by week
  const weeklyForecast = useMemo(() => {
    const weeks: Array<{
      label: string;
      startDate: string;
      endDate: string;
      totalInflows: number;
      totalOutflows: number;
      endBalance: number;
      hasCritical: boolean;
    }> = [];

    for (let i = 0; i < forecast.length; i += 7) {
      const weekDays = forecast.slice(i, i + 7);
      if (weekDays.length === 0) continue;

      const totalInflows = weekDays.reduce((sum, d) => sum + d.inflows, 0);
      const totalOutflows = weekDays.reduce((sum, d) => sum + d.outflows, 0);
      const endBalance = weekDays[weekDays.length - 1]?.balance || 0;
      const hasCritical = weekDays.some(d => d.balance < 0);

      weeks.push({
        label: `Semana ${weeks.length + 1}`,
        startDate: weekDays[0].date,
        endDate: weekDays[weekDays.length - 1].date,
        totalInflows,
        totalOutflows,
        endBalance,
        hasCritical,
      });
    }

    return weeks;
  }, [forecast]);

  // Upcoming expenses (next 7 days)
  const upcomingExpenses = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return scheduledExpenses
      .filter(exp => {
        const dueDate = new Date(exp.dueDate);
        return dueDate >= today && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [scheduledExpenses]);

  const totalUpcomingExpenses = upcomingExpenses.reduce((sum, e) => sum + e.amount, 0);
  const willCoverExpenses = currentBalance >= totalUpcomingExpenses;

  const categoryClasses: Record<string, string> = {
    sueldos: styles.catSueldos,
    servicios: styles.catServicios,
    impuestos: styles.catImpuestos,
    proveedores: styles.catProveedores,
  };

  return (
    <div className={styles.cashForecast}>
      {/* Alert if upcoming expenses exceed balance */}
      {!willCoverExpenses && totalUpcomingExpenses > 0 && (
        <div className={`${styles.alert} ${styles.alertDanger}`}>
          <AlertTriangle size={20} />
          <div className={styles.alertContent}>
            <strong>Alerta de liquidez</strong>
            <p>
              Tenés egresos por {formatCurrency(totalUpcomingExpenses)} esta semana 
              pero tu saldo es {formatCurrency(currentBalance)}.
              Te faltan {formatCurrency(totalUpcomingExpenses - currentBalance)}.
            </p>
          </div>
        </div>
      )}

      {/* Weekly forecast */}
      <div className={styles.weeks}>
        <h4 className={styles.sectionTitle}>
          <Calendar size={16} />
          Proyección semanal
        </h4>
        <div className={styles.weeksGrid}>
          {weeklyForecast.slice(0, 4).map((week, i) => (
            <div 
              key={i} 
              className={`${styles.week} ${week.hasCritical ? styles.weekCritical : ''}`}
            >
              <div className={styles.weekHeader}>
                <span className={styles.weekLabel}>{week.label}</span>
                <span className={styles.weekDates}>
                  {formatDateShort(week.startDate)} - {formatDateShort(week.endDate)}
                </span>
              </div>
              <div className={styles.weekFlows}>
                <div className={`${styles.flow} ${styles.flowIn}`}>
                  <TrendingUp size={14} />
                  <span>+{formatCurrency(week.totalInflows, { compact: true })}</span>
                </div>
                <div className={`${styles.flow} ${styles.flowOut}`}>
                  <TrendingDown size={14} />
                  <span>-{formatCurrency(week.totalOutflows, { compact: true })}</span>
                </div>
              </div>
              <div className={`${styles.weekBalance} ${week.endBalance < 0 ? styles.negativeEndBalance : ''}`}>
                <span className="label">Saldo final</span>
                <span className="value">{formatCurrency(week.endBalance, { compact: true })}</span>
              </div>
              {week.hasCritical && (
                <div className={styles.weekWarning}>
                  <AlertCircle size={12} />
                  <span>Riesgo de liquidez</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming expenses */}
      <div className={styles.expenses}>
        <div className={styles.expensesHeader}>
          <h4 className={styles.sectionTitle}>
            <AlertCircle size={16} />
            Egresos próximos 7 días
          </h4>
          {onAddExpense && (
            <button onClick={onAddExpense} className={styles.addBtn}>
              + Agregar
            </button>
          )}
        </div>

        {upcomingExpenses.length > 0 ? (
          <div className={styles.expensesList}>
            {upcomingExpenses.map(expense => (
              <div key={expense.id} className={styles.expense}>
                <div className={styles.expenseInfo}>
                  <span className={`${styles.expenseCategory} ${categoryClasses[expense.category] || ''}`}>
                    {expense.category}
                  </span>
                  <span className={styles.expenseName}>{expense.name}</span>
                </div>
                <div className={styles.expenseDetails}>
                  <span className={styles.expenseDate}>
                    {formatDateShort(expense.dueDate)}
                  </span>
                  <span className={styles.expenseAmount}>
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              </div>
            ))}
            <div className={styles.expensesTotal}>
              <span>Total próximos 7 días</span>
              <span className={styles.expensesTotalValue}>
                {formatCurrency(totalUpcomingExpenses)}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.expensesEmpty}>
            <p>No hay egresos programados</p>
            {onAddExpense && (
              <button onClick={onAddExpense} className="btn btn-secondary btn-sm">
                Agregar egreso recurrente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Critical days alert */}
      {criticalDays.length > 0 && (
        <div className={styles.critical}>
          <h4 className={styles.sectionTitle}>
            <AlertTriangle size={16} />
            Días críticos detectados
          </h4>
          <ul className={styles.criticalList}>
            {criticalDays.slice(0, 5).map(day => (
              <li key={day.date} className={styles.criticalDay}>
                <span className="date">{formatDateShort(day.date)}</span>
                <span className={`balance ${day.balance < 0 ? 'negative' : 'warning'}`}>
                  {formatCurrency(day.balance)}
                </span>
                {day.scheduledExpenses.length > 0 && (
                  <span className="reason">
                    ({day.scheduledExpenses.map(e => e.name).join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CashForecast;


