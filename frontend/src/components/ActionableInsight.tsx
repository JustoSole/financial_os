import { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  ArrowRight 
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import styles from './ActionableInsight.module.css';

export interface InsightStep {
  id: string;
  text: string;
  completed?: boolean;
  link?: string;
}

export interface ActionableInsightProps {
  type: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  impact?: {
    value: number;
    label: string;
    type: 'savings' | 'revenue' | 'loss' | 'cost';
  };
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  steps?: InsightStep[];
  evidence?: Array<{ label: string; value: string }>;
  onStepComplete?: (stepId: string) => void;
  expandable?: boolean;
  defaultExpanded?: boolean;
}

const typeConfig = {
  critical: {
    icon: AlertTriangle,
    badge: 'URGENTE',
    colorClass: styles.critical,
    badgeClass: styles.badgeCritical,
  },
  warning: {
    icon: AlertCircle,
    badge: 'ATENCIÓN',
    colorClass: styles.warning,
    badgeClass: styles.badgeWarning,
  },
  positive: {
    icon: CheckCircle,
    badge: 'OPORTUNIDAD',
    colorClass: styles.positive,
    badgeClass: styles.badgePositive,
  },
  info: {
    icon: AlertCircle,
    badge: 'INFO',
    colorClass: styles.info,
    badgeClass: styles.badgeInfo,
  },
};

export function ActionableInsight({
  type,
  title,
  description,
  impact,
  action,
  steps,
  evidence,
  onStepComplete,
  expandable = true,
  defaultExpanded = false,
}: ActionableInsightProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = typeConfig[type];
  const Icon = config.icon;

  const completedStepsCount = steps?.filter(s => s.completed).length || 0;
  const totalSteps = steps?.length || 0;

  const getImpactClass = () => {
    if (!impact) return '';
    switch (impact.type) {
      case 'savings':
      case 'revenue':
        return styles.impactPositive;
      case 'loss':
      case 'cost':
        return styles.impactNegative;
      default:
        return '';
    }
  };

  const getImpactPrefix = () => {
    if (!impact) return '';
    switch (impact.type) {
      case 'savings':
        return 'Ahorro: ';
      case 'revenue':
        return 'Revenue: +';
      case 'loss':
        return 'Pérdida: -';
      case 'cost':
        return 'Costo: ';
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.actionableInsight} ${config.colorClass}`}>
      {/* Header */}
      <div 
        className={styles.header}
        onClick={() => expandable && setExpanded(!expanded)}
        style={{ cursor: expandable ? 'pointer' : 'default' }}
      >
        <div className={styles.headerLeft}>
          <div className={styles.icon}>
            <Icon size={20} />
          </div>
          <div className={styles.headerContent}>
            <div className={styles.badgeRow}>
              <span className={`${styles.badge} ${config.badgeClass}`}>
                {config.badge}
              </span>
              {totalSteps > 0 && (
                <span className={styles.progress}>
                  {completedStepsCount}/{totalSteps} pasos
                </span>
              )}
            </div>
            <h3 className={styles.title}>{title}</h3>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          {impact && (
            <div className={`${styles.impact} ${getImpactClass()}`}>
              <span className={styles.impactValue}>
                {getImpactPrefix()}{formatCurrency(impact.value)}
              </span>
              <span className={styles.impactLabel}>{impact.label}</span>
            </div>
          )}
          {expandable && (
            <button className={styles.expandBtn}>
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Description (always visible) */}
      <p className={styles.description}>{description}</p>

      {/* Expanded content */}
      {expanded && (
        <div className={styles.body}>
          {/* Evidence */}
          {evidence && evidence.length > 0 && (
            <div className={styles.evidence}>
              {evidence.map((ev, i) => (
                <div key={i} className={styles.evidenceItem}>
                  <span className={styles.evidenceLabel}>{ev.label}</span>
                  <span className={styles.evidenceValue}>{ev.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Steps */}
          {steps && steps.length > 0 && (
            <div className={styles.steps}>
              <h4 className={styles.stepsTitle}>Pasos a seguir:</h4>
              <ul className={styles.stepsList}>
                {steps.map((step, i) => (
                  <li 
                    key={step.id} 
                    className={`${styles.step} ${step.completed ? styles.stepCompleted : ''}`}
                    onClick={() => !step.completed && onStepComplete?.(step.id)}
                  >
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <span className={styles.stepText}>{step.text}</span>
                    {step.link && (
                      <a 
                        href={step.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.stepLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {step.completed && <CheckCircle size={16} className={styles.stepCheck} />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action button */}
          {action && (
            <div className={styles.action}>
              {action.href ? (
                <a href={action.href} className={styles.actionBtn}>
                  {action.label}
                  <ArrowRight size={16} />
                </a>
              ) : (
                <button onClick={action.onClick} className={styles.actionBtn}>
                  {action.label}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActionableInsight;


