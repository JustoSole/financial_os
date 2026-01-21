import { ReactNode } from 'react';
import { ArrowRight, Zap, Clock, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import styles from './PriorityAction.module.css';

export interface PriorityActionProps {
  title: string;
  description: string;
  impact: {
    value: number;
    label: string;
  };
  urgency: 'now' | 'this_week' | 'this_month';
  href: string;
  icon?: ReactNode;
  steps?: string[];
}

const urgencyConfig = {
  now: { label: 'Hacer ahora', icon: Zap, class: styles.now },
  this_week: { label: 'Esta semana', icon: Clock, class: styles.week },
  this_month: { label: 'Este mes', icon: Clock, class: styles.month },
};

export function PriorityAction({
  title,
  description,
  impact,
  urgency,
  href,
  icon,
  steps,
}: PriorityActionProps) {
  const config = urgencyConfig[urgency];
  const UrgencyIcon = config.icon;

  return (
    <div className={`${styles.priorityAction} ${config.class}`}>
      <div className={styles.header}>
        <div className={styles.urgency}>
          <UrgencyIcon size={14} />
          <span>{config.label}</span>
        </div>
        <div className={styles.impact}>
          <DollarSign size={14} />
          <span>{formatCurrency(impact.value)} {impact.label}</span>
        </div>
      </div>

      <div className={styles.body}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <div className={styles.content}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
          
          {steps && steps.length > 0 && (
            <ul className={styles.steps}>
              {steps.slice(0, 3).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Link to={href} className={styles.cta}>
        <span>Empezar</span>
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}

export default PriorityAction;


