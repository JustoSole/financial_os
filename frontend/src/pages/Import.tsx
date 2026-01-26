import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getImportHistory, trackEvent } from '../api';
import ImportWizard from '../components/ImportWizard';
import styles from './Import.module.css';

export default function Import() {
  const { property } = useApp();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (property?.id) {
      loadHistory();
      trackEvent(property.id, 'view_import');
    }
  }, [property?.id]);

  const loadHistory = async () => {
    if (!property?.id) return;
    setLoading(true);
    try {
      const res = await getImportHistory(property.id);
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const reportNames: Record<string, string> = {
    expanded_transactions: 'Transacciones',
    reservations_financials: 'Reservas',
    unknown: 'Desconocido',
  };

  return (
    <div className={styles.pageImport}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Importar datos</h1>
          <p className={styles.pageSubtitle}>Subí tus reportes de Cloudbeds para actualizar tu Dashboard</p>
        </div>
      </div>

      <div className={styles.importSection}>
        <ImportWizard />
      </div>

      <div className={styles.historySection}>
        <h3 className={styles.sectionTitle}>Historial de importaciones</h3>
        {loading ? (
          <div className={styles.historyLoading}>Cargando historial...</div>
        ) : history && history.length > 0 ? (
          <div className={styles.historyList}>
            {history.map((file) => (
              <div key={file.id} className={styles.historyItem}>
                <div className={styles.historyContent}>
                  <span className={styles.historyName}>{file.filename}</span>
                  <span className={styles.historyMeta}>
                    {reportNames[file.report_type] || file.report_type} • {file.rows} filas
                  </span>
                </div>
                <div className={styles.historyRight}>
                  <div className={styles.historyDate}>
                    {new Date(file.uploaded_at).toLocaleDateString()}
                  </div>
                  <span className={`${styles.badge} ${file.status === 'processed' ? styles.badgeSuccess : styles.badgeError}`}>
                    {file.status === 'processed' ? 'Éxito' : 'Error'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.historyEmpty}>No hay importaciones aún</div>
        )}
      </div>
    </div>
  );
}
