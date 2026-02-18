import { Shield, Clock, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import styles from './ConfidenceHeader.module.css';

export function getCompletarDatosDestination(issues: string[]): string {
  const hasCostosIssue = issues.some(
    (i) => /costos|configurar costos|costos fijos/i.test(i)
  );
  const hasImportIssue = issues.some(
    (i) => /importar|falta|transactions|reservations|reporte/i.test(i)
  );
  if (hasCostosIssue && !hasImportIssue) return '/costos';
  if (hasImportIssue) return '/importar';
  return '/importar';
}

export default function ConfidenceHeader() {
  const { metrics, loading } = useApp();
  const navigate = useNavigate();

  if (loading || !metrics?.dataHealth) return null;

  const { score, issues, lastImport, monthsCovered } = metrics.dataHealth;
  const healthLevel = (score || 0) >= 80 ? 'high' : (score || 0) >= 50 ? 'medium' : 'low';
  
  const lastImportDate = lastImport ? new Date(lastImport) : null;
  const isOldData = lastImportDate ? (Date.now() - lastImportDate.getTime()) > (7 * 24 * 60 * 60 * 1000) : false;
  const completarDatosTo = getCompletarDatosDestination(issues || []);

  return (
    <div className={`${styles.header} ${styles[healthLevel]}`}>
      <div className={styles.container}>
        <div className={styles.section}>
          <div className={styles.scoreBadge}>
            <Shield size={16} className={styles.icon} />
            <span className={styles.scoreLabel}>Confianza:</span>
            <span className={styles.scoreValue}>{score || 0}%</span>
          </div>
          
          <div className={styles.divider} />
          
          <div className={styles.infoItem}>
            <Clock size={14} className={styles.icon} />
            <span className={styles.infoLabel}>Última carga:</span>
            <span className={`${styles.infoValue} ${isOldData ? styles.warning : ''}`}>
              {lastImportDate ? lastImportDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 'Nunca'}
            </span>
          </div>
          
          <div className={styles.divider} />
          
          <div className={styles.infoItem}>
            <Database size={14} className={styles.icon} />
            <span className={styles.infoLabel}>Cobertura:</span>
            <span className={styles.infoValue}>{monthsCovered || 0} {(monthsCovered || 0) === 1 ? 'mes' : 'meses'}</span>
          </div>
        </div>

        {(issues || []).length > 0 && (
          <div className={styles.issuesSection}>
            <AlertTriangle size={14} className={styles.warningIcon} />
            <div className={styles.issuesList}>
              {issues.slice(0, 2).map((issue: string, i: number) => (
                <span key={i} className={styles.issue}>{issue}{i < Math.min(issues.length, 2) - 1 ? ' • ' : ''}</span>
              ))}
              {issues.length > 2 && <span className={styles.issue}> y {issues.length - 2} más</span>}
            </div>
            <button 
              className={styles.fixButton}
              onClick={() => navigate(completarDatosTo)}
            >
              Completar datos
            </button>
          </div>
        )}

        {(score || 0) >= 90 && (issues || []).length === 0 && (
          <div className={styles.successSection}>
            <CheckCircle size={14} className={styles.successIcon} />
            <span>Datos completos y actualizados</span>
          </div>
        )}
      </div>
    </div>
  );
}

