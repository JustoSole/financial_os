import { useState } from 'react';
import { DailyMetric } from '@financial-os/shared';
import { formatCurrencyShort } from '../utils/formatters';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CalendarProjection.module.css';

interface CalendarProjectionProps {
  data: DailyMetric[];
}

export default function CalendarProjection({ data }: CalendarProjectionProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  if (!data || data.length === 0) return null;

  const todayStr = new Date().toISOString().substring(0, 10);

  // Helper to get days in a month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      // Format as YYYY-MM-DD for matching with data
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
      
      const metric = data.find(m => m.date.startsWith(dateKey));
      days.push({ date: d, dateStr: dateKey, metric });
    }
    return days;
  };

  const monthDays = getDaysInMonth(currentMonth);
  const startDay = monthDays[0].date.getDay(); // 0 (Sun) to 6 (Sat)
  
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const padding = Array.from({ length: startDay }, () => null);
  const gridItems = [...padding, ...monthDays];

  const getHeatmapColor = (occupancy: number) => {
    if (occupancy === 0) return 'var(--color-bg-subtle)';
    
    const color = '34, 197, 94'; // Always Green
    
    if (occupancy < 20) return `rgba(${color}, 0.1)`;
    if (occupancy < 40) return `rgba(${color}, 0.3)`;
    if (occupancy < 60) return `rgba(${color}, 0.5)`;
    if (occupancy < 80) return `rgba(${color}, 0.7)`;
    return `rgba(${color}, 0.9)`;
  };

  const handlePrev = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.container}>
      <div className={styles.navHeader}>
        <div className={styles.periodInfo}>
          <CalendarIcon size={18} className={styles.calendarIcon} />
          <span className={styles.periodDates}>{monthName}</span>
        </div>
        <div className={styles.navControls}>
          <div className={styles.navButtons}>
            <button onClick={handlePrev} className={styles.navButton} title="Mes Anterior">
              <ChevronLeft size={18} />
            </button>
            <button onClick={handleNext} className={styles.navButton} title="Mes Siguiente">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.header}>
        {dayLabels.map(label => (
          <div key={label} className={styles.dayLabel}>{label}</div>
        ))}
      </div>
      
      <div className={styles.grid}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentMonth.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={styles.gridMotion}
          >
            {gridItems.map((item, index) => {
              if (!item) return <div key={`empty-${index}`} className={styles.emptyCell} />;
              
              const { date, dateStr, metric } = item;
              const dayNum = date.getDate();
              const isToday = dateStr === todayStr;

              return (
                <motion.div 
                  key={dateStr} 
                  whileHover={{ scale: 1.05 }}
                  className={`${styles.cell} ${isToday ? styles.todayCell : ''}`}
                  style={{ backgroundColor: metric ? getHeatmapColor(metric.occupancy) : 'var(--color-bg-subtle)' }}
                >
                  <div className={styles.cellHeader}>
                    <span className={styles.dayNum}>{dayNum}</span>
                  </div>
                  {metric && (
                    <div className={styles.cellBody}>
                      <span className={styles.revenue}>{formatCurrencyShort(metric.revenue)}</span>
                      <span className={styles.occupancy}>{Math.round(metric.occupancy)}%</span>
                    </div>
                  )}

                  {metric && (
                    <div className={styles.tooltip}>
                      <strong>{date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                      {metric.isPast && <div className={styles.pastBadge}>Dato Histórico</div>}
                      <div>Revenue: {formatCurrencyShort(metric.revenue)}</div>
                      <div>Ocupación: {Math.round(metric.occupancy)}% ({metric.nights} noches)</div>
                      <div>ADR: {formatCurrencyShort(metric.adr)}</div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
