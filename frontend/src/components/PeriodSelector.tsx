import { Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PERIOD_OPTIONS = [
  { value: 30, label: 'Últimos 30 días' },
  { value: 60, label: 'Últimos 60 días' },
  { value: 90, label: 'Últimos 90 días' },
  { value: 180, label: 'Últimos 6 meses' },
  { value: 365, label: 'Último año' },
];

export default function PeriodSelector() {
  const { dateRange, setDateRange } = useApp();

  return (
    <div className="period-selector">
      <div className="selector-trigger">
        <Calendar size={16} />
        <select 
          value={dateRange.preset || dateRange.days} 
          onChange={(e) => setDateRange({ preset: Number(e.target.value) as 7 | 30 | 90 | null })}
          className="selector-input"
        >
          {PERIOD_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} />
      </div>

      <style>{`
        .period-selector {
          position: relative;
        }

        .selector-trigger {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .selector-trigger:hover {
          border-color: var(--color-border-hover);
        }

        .selector-trigger:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-subtle);
        }

        .selector-trigger svg {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        .selector-input {
          appearance: none;
          background: none;
          border: none;
          font-family: var(--font-sans);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          cursor: pointer;
          outline: none;
          padding-right: var(--space-4);
        }

        .selector-input option {
          background: var(--color-bg-card);
          color: var(--color-text);
          padding: var(--space-2);
        }
      `}</style>
    </div>
  );
}
