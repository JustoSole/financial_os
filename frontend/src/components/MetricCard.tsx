import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { formatCurrency as formatCurrencyUtil, formatPercent, formatNumber } from '../utils/formatters';

interface MetricCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  changePercent?: number;
  trust?: 'real' | 'estimado' | 'incompleto';
  format?: 'currency' | 'percent' | 'number';
  tooltip?: string;
  variant?: 'default' | 'hero' | 'compact';
  icon?: React.ReactNode;
}

export default function MetricCard({
  title,
  value,
  previousValue,
  changePercent,
  trust,
  format = 'number',
  tooltip,
  variant = 'default',
  icon,
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return formatCurrencyUtil(val, { currency: 'ARS' });
      case 'percent':
        return formatPercent(val, { decimals: 1 });
      default:
        return formatNumber(val);
    }
  };

  const getChangeIcon = () => {
    if (!changePercent || changePercent === 0) return <Minus size={14} />;
    return changePercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
  };

  const getChangeClass = () => {
    if (!changePercent || changePercent === 0) return 'neutral';
    return changePercent > 0 ? 'positive' : 'negative';
  };

  const getTrustBadge = () => {
    if (!trust || trust === 'estimado') return null;
    const badges: Record<string, { label: string; variant: string }> = {
      real: { label: 'Real', variant: 'success' },
      estimado: { label: 'Estimado', variant: 'warning' },
      incompleto: { label: 'Incompleto', variant: 'error' },
    };
    return badges[trust];
  };

  const trustBadge = getTrustBadge();

  return (
    <div className={`metric-card metric-card--${variant}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">
          {icon && <span className="metric-card__icon">{icon}</span>}
          {title}
          {tooltip && (
            <span className="metric-card__tooltip">
              <HelpCircle size={14} />
              <span className="tooltip-content">{tooltip}</span>
            </span>
          )}
        </span>
        {trustBadge && (
          <span className={`ui-badge ui-badge--${trustBadge.variant} ui-badge--sm`}>
            {trustBadge.label}
          </span>
        )}
      </div>

      <div className="metric-card__body">
        <span className="metric-card__value">{formatValue(value)}</span>

        {(changePercent !== undefined || previousValue !== undefined) && (
          <div className="metric-card__change-row">
            {changePercent !== undefined && (
              <span className={`metric-card__change metric-card__change--${getChangeClass()}`}>
                {getChangeIcon()}
                {changePercent > 0 ? '+' : ''}
                {changePercent.toFixed(1)}%
              </span>
            )}
            {previousValue !== undefined && (
              <span className="metric-card__previous">vs {formatValue(previousValue)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
