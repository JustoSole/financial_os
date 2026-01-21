import { AlertCircle, CheckCircle, AlertTriangle, Upload, ChevronRight } from 'lucide-react';
import styles from './DataHealthBanner.module.css';

interface DataHealthBannerProps {
  score: number;
  issues: string[];
  lastImport?: string | null;
}

export default function DataHealthBanner({ score, issues }: DataHealthBannerProps) {
  const getStatus = () => {
    if (score >= 80) return 'excellent';
    if (score >= 50) return 'partial';
    return 'incomplete';
  };

  const status = getStatus();
  
  const statusConfig = {
    excellent: {
      icon: CheckCircle,
      title: 'Datos completos',
      subtitle: 'Tus métricas son precisas',
      color: styles.success,
    },
    partial: {
      icon: AlertTriangle,
      title: 'Datos parciales',
      subtitle: 'Algunos valores son estimados',
      color: styles.warning,
    },
    incomplete: {
      icon: AlertCircle,
      title: 'Faltan datos',
      subtitle: 'Importá reportes para ver métricas',
      color: styles.error,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Calculate suggestions
  const suggestions = [
    { text: 'Subir Expanded Transactions', points: 40, done: score >= 50 },
    { text: 'Subir Reservations Report', points: 35, done: score >= 85 },
    { text: 'Subir Channel Performance', points: 10, done: !issues.includes('Sin datos de Channel Performance') },
  ].filter(s => !s.done);

  // Don't show banner if excellent
  if (status === 'excellent' && issues.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.healthBanner} ${styles[status]}`}>
      <div className={styles.main}>
        <div className={`${styles.icon} ${config.color}`}>
          <Icon size={20} />
        </div>
        
        <div className={styles.content}>
          <div className={styles.header}>
            <strong>{config.title}</strong>
            <div className={styles.score}>
              <div className={styles.scoreBar}>
                <div className={`${styles.scoreFill} ${config.color}`} style={{ width: `${score}%` }} />
              </div>
              <span className={styles.scoreValue}>{score}/100</span>
            </div>
          </div>
          <span className={styles.subtitle}>{config.subtitle}</span>
        </div>

        {status !== 'excellent' && (
          <a href="/importar" className={`btn btn-secondary ${styles.action}`}>
            <Upload size={16} />
            Importar datos
            <ChevronRight size={16} />
          </a>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && status !== 'excellent' && (
        <div className={styles.suggestions}>
          <span className={styles.suggestionsLabel}>Para mejorar:</span>
          {suggestions.slice(0, 2).map((suggestion, i) => (
            <a key={i} href="/importar" className={styles.suggestionChip}>
              {suggestion.text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
