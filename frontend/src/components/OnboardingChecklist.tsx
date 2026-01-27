import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle, 
  Circle, 
  Upload, 
  Settings, 
  BarChart3, 
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PlayCircle
} from 'lucide-react';
import styles from './OnboardingChecklist.module.css';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  helpLink?: string;
  videoUrl?: string;
}

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onStepClick?: (stepId: string) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const stepIcons: Record<string, any> = {
  transactions: Upload,
  reservations: Upload,
  costs: Settings,
  review: BarChart3,
};

export function OnboardingChecklist({
  steps,
  onStepClick,
  onDismiss,
  compact = false,
}: OnboardingChecklistProps) {
  const [expanded, setExpanded] = useState(!compact);
  
  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  if (allComplete && compact) {
    return null;
  }

  return (
    <div className={`${styles.onboardingChecklist} ${compact ? styles.compact : ''}`}>
      <div 
        className={styles.header}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className={styles.headerContent}>
          <h3 className={styles.title}>
            {allComplete ? '¡Configuración completa!' : 'Configurá tu cuenta'}
          </h3>
          <p className={styles.subtitle}>
            {allComplete 
              ? 'Ya podés ver tus métricas financieras'
              : `${completedCount} de ${steps.length} pasos completados`
            }
          </p>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.progress}>
            <div 
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
          {compact && (
            <button className={styles.toggle}>
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.steps}>
          {steps.map((step, index) => {
            const Icon = stepIcons[step.id] || Circle;
            
            return (
              <div 
                key={step.id}
                className={`${styles.step} ${step.completed ? styles.stepCompleted : ''}`}
                onClick={() => !step.completed && onStepClick?.(step.id)}
              >
                <div className={styles.stepIndicator}>
                  {step.completed ? (
                    <CheckCircle size={24} className={styles.stepCheck} />
                  ) : (
                    <span className={styles.stepNumber}>{index + 1}</span>
                  )}
                </div>
                
                <div className={styles.stepContent}>
                  <h4 className={styles.stepTitle}>{step.title}</h4>
                  <p className={styles.stepDescription}>{step.description}</p>
                  
                  {!step.completed && (
                    <div className={styles.stepActions}>
                      {step.action && (
                        step.action.href ? (
                          <Link to={step.action.href} className="btn btn-primary btn-sm">
                            {step.action.label}
                          </Link>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              step.action?.onClick?.();
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            {step.action.label}
                          </button>
                        )
                      )}
                      {step.helpLink && (
                        <a 
                          href={step.helpLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.stepHelp}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                          Ver guía
                        </a>
                      )}
                      {step.videoUrl && (
                        <a 
                          href={step.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.stepVideo}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PlayCircle size={14} />
                          Video (30s)
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.stepIcon}>
                  <Icon size={20} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allComplete && onDismiss && (
        <div className={styles.footer}>
          <button onClick={onDismiss} className="btn btn-ghost btn-sm">
            Ocultar
          </button>
        </div>
      )}
    </div>
  );
}

export default OnboardingChecklist;


