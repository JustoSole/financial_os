import { useState } from 'react';
import { Card } from '../ui';
import { History, TrendingUp } from 'lucide-react';
import styles from './ActionLogSection.module.css';

interface ActionLogEntry {
  date: string;
  action: string;
  result?: string;
}

interface ActionLogSectionProps {
  entries?: ActionLogEntry[];
}

export function ActionLogSection({ entries = [] }: ActionLogSectionProps) {
  // For now, use local storage to persist actions
  // In Phase 3b, this will be replaced with database persistence
  const [localEntries] = useState(() => {
    try {
      const stored = localStorage.getItem('pricing_actions_log');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })[0];

  const allEntries = [...entries, ...localEntries].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 10);

  if (allEntries.length === 0) {
    return (
      <Card className={styles.container}>
        <h3 className={styles.title}>
          <History size={20} />
          Historial de Acciones
        </h3>
        <p className={styles.empty}>Aún no hay acciones registradas.</p>
      </Card>
    );
  }

  return (
    <Card className={styles.container}>
      <h3 className={styles.title}>
        <History size={20} />
        Historial de Acciones
      </h3>
      <p className={styles.subtitle}>
        Acciones que aplicaste y sus resultados
      </p>

      <div className={styles.entriesList}>
        {allEntries.map((entry, idx) => (
          <div key={idx} className={styles.entry}>
            <div className={styles.entryDate}>
              {new Date(entry.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </div>
            <div className={styles.entryContent}>
              <div className={styles.entryAction}>{entry.action}</div>
              {entry.result && (
                <div className={styles.entryResult}>
                  <TrendingUp size={14} />
                  <span>{entry.result}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

