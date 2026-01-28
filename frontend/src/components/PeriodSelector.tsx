import { Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PERIOD_OPTIONS = [
  { value: 30, label: '30 días' },
  { value: 60, label: '60 días' },
  { value: 90, label: '90 días' },
  { value: 180, label: '6 meses' },
  { value: 365, label: '1 año' },
] as const;

interface PeriodSelectorProps {
  value?: number;
  onChange?: (value: number) => void;
  options?: readonly { value: number; label: string }[];
  labelPrefix?: string;
}

export default function PeriodSelector({ value, onChange, options = PERIOD_OPTIONS, labelPrefix = 'Últimos' }: PeriodSelectorProps) {
  const { dateRange, setDateRange } = useApp();
  
  const currentValue = value !== undefined ? value : (dateRange.preset || dateRange.days);
  const currentLabel = options.find(opt => opt.value === currentValue)?.label || 'Seleccionar período';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = Number(e.target.value);
    if (onChange) {
      onChange(newValue);
    } else {
      setDateRange({ preset: newValue as any });
    }
  };

  return (
    <div className="period-selector">
      <label className="selector-trigger">
        <Calendar size={16} className="selector-icon" />
        <span className="selector-label">{labelPrefix} {currentLabel}</span>
        <ChevronDown size={16} className="selector-chevron" />
        <select 
          value={currentValue} 
          onChange={handleChange}
          className="selector-input"
          aria-label="Seleccionar período de tiempo"
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <style>{`
        .period-selector {
          position: relative;
          display: inline-block;
        }

        .selector-trigger {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 8px);
          padding: var(--space-2, 8px) var(--space-4, 16px);
          background: var(--color-bg-card, #fff);
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: var(--radius-lg, 8px);
          cursor: pointer;
          transition: all var(--transition-fast, 0.15s ease);
          position: relative;
        }

        .selector-trigger:hover {
          border-color: var(--color-border-hover, #c0c0c0);
        }

        .selector-trigger:focus-within {
          border-color: var(--color-primary, #3b82f6);
          box-shadow: 0 0 0 3px var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
        }

        .selector-icon,
        .selector-chevron {
          color: var(--color-text-muted, #6b7280);
          flex-shrink: 0;
          pointer-events: none;
        }

        .selector-label {
          font-family: var(--font-sans, system-ui, sans-serif);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text, #1f2937);
          pointer-events: none;
          white-space: nowrap;
        }

        .selector-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          font-size: 16px; /* Prevents iOS zoom */
        }

        .selector-input option {
          background: var(--color-bg-card, #fff);
          color: var(--color-text, #1f2937);
          padding: var(--space-2, 8px);
        }
      `}</style>
    </div>
  );
}
