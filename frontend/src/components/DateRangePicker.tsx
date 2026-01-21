import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import styles from './DateRangePicker.module.css';

const PRESETS = [
  { label: '7 días', value: 7 },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
];

export default function DateRangePicker() {
  const { dateRange, setDateRange } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState({
    start: dateRange.start.toISOString().substring(0, 10),
    end: dateRange.end.toISOString().substring(0, 10),
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(tempRange.start);
    const end = new Date(tempRange.end);
    
    if (start > end) {
      alert('La fecha de inicio no puede ser posterior a la de fin');
      return;
    }

    setDateRange({
      preset: null,
      custom: { start, end }
    });
    setIsOpen(false);
  };

  const currentLabel = dateRange.preset 
    ? PRESETS.find(p => p.value === dateRange.preset)?.label 
    : `${dateRange.start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - ${dateRange.end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`;

  return (
    <div className={styles.container} ref={pickerRef}>
      <button 
        className={styles.trigger} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Seleccionar período"
      >
        <CalendarIcon size={16} />
        <span>{currentLabel}</span>
        <ChevronDown size={16} className={isOpen ? styles.chevronOpen : ''} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.presets}>
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                className={`${styles.presetOption} ${dateRange.preset === preset.value ? styles.active : ''}`}
                onClick={() => {
                  setDateRange({ preset: preset.value as 7 | 30 | 90 });
                  setIsOpen(false);
                }}
              >
                {preset.label}
                {dateRange.preset === preset.value && <Check size={14} />}
              </button>
            ))}
          </div>

          <div className={styles.divider}>O rango personalizado</div>

          <form className={styles.customForm} onSubmit={handleApplyCustom}>
            <div className={styles.inputGroup}>
              <label htmlFor="startDate">Desde</label>
              <input 
                type="date" 
                id="startDate"
                value={tempRange.start}
                onChange={(e) => setTempRange({ ...tempRange, start: e.target.value })}
                max={tempRange.end}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="endDate">Hasta</label>
              <input 
                type="date" 
                id="endDate"
                value={tempRange.end}
                onChange={(e) => setTempRange({ ...tempRange, end: e.target.value })}
                min={tempRange.start}
                max={new Date().toISOString().substring(0, 10)}
              />
            </div>
            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.applyBtn}>
                Aplicar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

