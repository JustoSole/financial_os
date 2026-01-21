import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  DollarSign,
  Clock,
  Zap,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { completeActionStep, trackEvent } from '../api';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';

interface ActionStep {
  text: string;
  completed: boolean;
}

interface ActionCardProps {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: {
    value: number;
    unit: string;
    direction: 'positive' | 'negative';
  };
  confidence: 'high' | 'medium' | 'low';
  steps: ActionStep[];
  priority: number;
  onStepComplete?: (stepIndex: number) => void;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  cash_risk: { icon: AlertTriangle, color: 'error', label: 'Riesgo de caja' },
  channel_cost: { icon: DollarSign, color: 'warning', label: 'Costo de canal' },
  collections: { icon: DollarSign, color: 'success', label: 'Cobranza' },
  pricing_opportunity: { icon: TrendingUp, color: 'primary', label: 'Oportunidad' },
  ota_dependency: { icon: AlertTriangle, color: 'warning', label: 'Dependencia OTA' },
  data_quality: { icon: Zap, color: 'info', label: 'Datos' },
};

export default function ActionCard({
  id: _id,
  type,
  title,
  description,
  impact,
  confidence,
  steps,
  priority,
  onStepComplete,
}: ActionCardProps) {
  const { property } = useApp();
  const [expanded, setExpanded] = useState(priority <= 2);
  const [localSteps, setLocalSteps] = useState(steps);
  const [_loading, setLoading] = useState(false);

  const completedCount = localSteps.filter((s) => s.completed).length;
  const isComplete = completedCount === localSteps.length;

  const config = typeConfig[type] || typeConfig.data_quality;
  const Icon = config.icon;

  const handleToggleStep = async (index: number) => {
    if (!property || localSteps[index].completed) return;

    setLoading(true);
    try {
      await completeActionStep(property.id, type, index);
      trackEvent(property.id, 'action_checked', { actionType: type, stepIndex: index });

      const newSteps = [...localSteps];
      newSteps[index] = { ...newSteps[index], completed: true };
      setLocalSteps(newSteps);

      onStepComplete?.(index);
    } catch (err) {
      console.error('Error completing step:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatImpact = () => {
    if (impact.value === 0) return null;
    return formatCurrency(impact.value, { currency: 'ARS' });
  };

  return (
    <div
      className={`action-card ${expanded ? 'action-card--expanded' : ''} ${isComplete ? 'action-card--complete' : ''}`}
    >
      {/* Hero Impact Section */}
      <div
        className={`action-card__impact action-card__impact--${impact.direction} ${impact.value > 100000 ? 'action-card__impact--urgent' : ''}`}
      >
        <div className="action-card__impact-main">
          <div className="action-card__impact-icon">
            <DollarSign size={24} />
          </div>
          <div className="action-card__impact-details">
            <span className="action-card__impact-amount">
              {impact.value > 0 ? formatImpact() : 'Insight'}
            </span>
            <span className="action-card__impact-label">Impacto en tu ganancia {impact.unit}</span>
          </div>
        </div>
        {impact.value > 100000 && (
          <div className="action-card__urgency">
            <Zap size={14} />
            Prioridad Alta
          </div>
        )}
      </div>

      <div className="action-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="action-card__main">
          <div className={`action-card__icon action-card__icon--${config.color}`}>
            <Icon size={20} />
          </div>
          <div className="action-card__content">
            <h4 className="action-card__title">{title}</h4>
            <p className="action-card__description">{description}</p>
          </div>
        </div>

        <div className="action-card__meta">
          <div className="action-card__progress-badge">
            {completedCount}/{localSteps.length}
          </div>
          <button className="action-card__toggle" type="button">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="action-card__body">
          {/* Steps */}
          <div className="action-card__steps">
            {localSteps.map((step, index) => (
              <div
                key={index}
                className={`action-card__step ${step.completed ? 'action-card__step--completed' : ''}`}
                onClick={() => handleToggleStep(index)}
              >
                <div
                  className={`action-card__step-check ${step.completed ? 'action-card__step-check--checked' : ''}`}
                >
                  {step.completed && <Check size={14} />}
                </div>
                <span className="action-card__step-text">{step.text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="action-card__footer">
            <div className={`action-card__confidence action-card__confidence--${confidence}`}>
              <Clock size={14} />
              <span>
                {confidence === 'high' && 'Alta certeza'}
                {confidence === 'medium' && 'Certeza media'}
                {confidence === 'low' && 'Estimado'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
