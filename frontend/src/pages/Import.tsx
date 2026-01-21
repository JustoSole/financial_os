import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  ArrowRight,
  FileUp,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getImportHistory, importFile, validateFile, trackEvent } from '../api';
import { OnboardingWizard } from '../components';

type ImportStep = 'upload' | 'validating' | 'importing' | 'complete' | 'error';

export default function Import() {
  const { property, refreshData } = useApp();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ImportStep>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (property) {
      loadHistory();
      trackEvent(property.id, 'view_import');
    }
  }, [property]);

  const loadHistory = async () => {
    if (!property) return;
    setLoading(true);
    const res = await getImportHistory(property.id);
    if (res.success && res.data) setHistory(res.data);
    setLoading(false);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (files.length > 0) handleFilesSelected(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFilesSelected(Array.from(e.target.files));
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!property) return;
    setSelectedFiles(files);
    setStep('validating');
    
    try {
      const result = await validateFile(files[0]);
      if (result.success) {
        setValidationResult(result.data);
        await handleImport(files);
      } else {
        setStep('error');
        setValidationResult({ error: result.error });
      }
    } catch {
      setStep('error');
      setValidationResult({ error: 'Error al validar el archivo' });
    }
  };

  const handleImport = async (files: File[]) => {
    if (!property) return;
    setStep('importing');
    
    try {
      for (const file of files) {
        const result = await importFile(property.id, file);
        if (result.success) setImportResult(result.data);
      }
      setStep('complete');
      refreshData();
      loadHistory();
      trackEvent(property.id, 'import_success');
    } catch {
      setStep('error');
      trackEvent(property.id, 'import_failed');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setSelectedFiles([]);
    setValidationResult(null);
    setImportResult(null);
  };

  const reportNames: Record<string, string> = {
    expanded_transactions: 'Expanded Transactions',
    reservations_financials: 'Reservations Report',
    channel_performance: 'Channel Performance',
    unknown: 'Desconocido',
  };

  return (
    <div className="page-import">
      <div className="page-header">
        <div>
          <h1 className="page-title">Importar datos</h1>
          <p className="page-subtitle">Subí tus reportes de Cloudbeds</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
          <Sparkles size={18} />
          Usar asistente guiado
        </button>
      </div>

      {showWizard && (
        <OnboardingWizard 
          onComplete={async () => {
            setShowWizard(false);
            refreshData();
            loadHistory();
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Upload Area */}
      <div className="import-section">
        {step === 'upload' && (
          <div 
            className={`upload-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <FileUp size={36} />
            </div>
            <h3>Arrastrá tu archivo CSV aquí</h3>
            <p>o hacé click para seleccionar</p>
            <input type="file" accept=".csv" onChange={handleFileInput} className="upload-input" />
            <button className="btn btn-primary btn-lg">
              <Upload size={18} />
              Seleccionar archivo
            </button>
            
            <div className="supported-reports">
              <span>Reportes soportados (Recomendado: últimos 13 meses para MoM/YoY):</span>
              <div className="report-tags">
                <span className="report-tag">Expanded Transactions (Hasta 3 años)</span>
                <span className="report-tag">Reservations with Financials (Hasta 3 años)</span>
                <span className="report-tag">Channel Performance (Hasta 3 años)</span>
              </div>
            </div>
          </div>
        )}

        {step === 'validating' && (
          <div className="processing-state">
            <div className="loading-spinner" />
            <h3>Analizando archivo...</h3>
            <p>Detectando tipo de reporte</p>
          </div>
        )}

        {step === 'importing' && (
          <div className="processing-state">
            <div className="loading-spinner" />
            <h3>Importando datos...</h3>
            <p>Procesando {selectedFiles[0]?.name}</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="complete-state">
            <div className="complete-icon">
              <CheckCircle size={36} />
            </div>
            <h2>¡Datos importados!</h2>
            <p>Se procesaron {importResult?.rows || 0} registros correctamente.</p>

            <div className="complete-actions">
              <a href="/" className="btn btn-primary btn-lg">
                Ver dashboard
                <ArrowRight size={18} />
              </a>
              <button onClick={resetImport} className="btn btn-secondary">
                Importar otro archivo
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="error-state">
            <div className="error-icon">
              <AlertCircle size={36} />
            </div>
            <h3>Error al importar</h3>
            <p>{validationResult?.error || 'Hubo un problema procesando el archivo'}</p>
            <button onClick={resetImport} className="btn btn-secondary">
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      {/* How to export guide */}
      <div className="guide-section">
        <h3>📋 Cómo exportar desde Cloudbeds</h3>
        <div className="guide-steps">
          <div className="guide-step">
            <span className="step-number">1</span>
            <span>Abrí el reporte en Cloudbeds</span>
          </div>
          <div className="guide-step">
            <span className="step-number">2</span>
            <span>Seleccioná el período deseado</span>
          </div>
          <div className="guide-step">
            <span className="step-number">3</span>
            <span>Click en "Export" → CSV</span>
          </div>
          <div className="guide-step">
            <span className="step-number">4</span>
            <span>Subí el archivo aquí</span>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="history-section">
        <h3>Historial de importaciones</h3>
        
        {loading ? (
          <div className="history-loading">
            <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <span>Cargando...</span>
          </div>
        ) : history.length > 0 ? (
          <div className="history-list">
            {history.map((file) => (
              <div key={file.id} className={`history-item ${file.status}`}>
                <div className="history-icon">
                  {file.status === 'processed' ? <CheckCircle size={18} /> : 
                   file.status === 'failed' ? <AlertCircle size={18} /> : <FileText size={18} />}
                </div>
                <div className="history-content">
                  <span className="history-name">{file.filename}</span>
                  <span className="history-meta">
                    {reportNames[file.report_type] || file.report_type} • {file.rows} registros
                  </span>
                </div>
                <div className="history-date">
                  <Clock size={14} />
                  {new Date(file.uploaded_at).toLocaleDateString('es-AR', { 
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <span className={`badge badge-${file.status === 'processed' ? 'success' : file.status === 'failed' ? 'error' : 'neutral'}`}>
                  {file.status === 'processed' ? 'Éxito' : file.status === 'failed' ? 'Error' : 'Procesando'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-empty">
            <FileText size={24} />
            <span>No hay importaciones anteriores</span>
          </div>
        )}
      </div>

      <style>{`
        .import-section {
          margin-bottom: var(--space-8);
        }

        /* Upload Zone */
        .upload-zone {
          background: white;
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-10);
          text-align: center;
          position: relative;
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-card);
        }

        .upload-zone.active {
          border-color: var(--color-primary);
          background: var(--color-primary-subtle);
        }

        .upload-icon {
          width: 64px;
          height: 64px;
          background: var(--color-bg-hover);
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-4);
          color: var(--color-text-muted);
        }

        .upload-zone.active .upload-icon {
          background: var(--color-primary);
          color: white;
        }

        .upload-zone h3 {
          margin-bottom: var(--space-2);
        }

        .upload-zone > p {
          color: var(--color-text-muted);
          margin-bottom: var(--space-5);
        }

        .upload-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          z-index: 10;
        }

        .supported-reports {
          margin-top: var(--space-6);
          padding-top: var(--space-5);
          border-top: 1px solid var(--color-border);
        }

        .supported-reports > span {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          display: block;
          margin-bottom: var(--space-3);
        }

        .report-tags {
          display: flex;
          justify-content: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .report-tag {
          padding: var(--space-1) var(--space-3);
          background: var(--color-bg-hover);
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }

        /* Processing State */
        .processing-state {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-12);
          text-align: center;
          box-shadow: var(--shadow-card);
        }

        .processing-state .loading-spinner {
          margin: 0 auto var(--space-4);
        }

        .processing-state p {
          color: var(--color-text-muted);
        }

        /* Complete State */
        .complete-state {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          text-align: center;
          box-shadow: var(--shadow-card);
        }

        .complete-icon {
          width: 64px;
          height: 64px;
          background: var(--color-success);
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin: 0 auto var(--space-4);
        }

        .complete-state h2 {
          margin-bottom: var(--space-2);
        }

        .complete-state > p {
          color: var(--color-text-secondary);
          margin-bottom: var(--space-6);
        }

        .complete-actions {
          display: flex;
          justify-content: center;
          gap: var(--space-3);
        }

        /* Error State */
        .error-state {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: var(--radius-xl);
          padding: var(--space-12);
          text-align: center;
          box-shadow: var(--shadow-card);
        }

        .error-icon {
          width: 64px;
          height: 64px;
          background: var(--color-error);
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin: 0 auto var(--space-4);
        }

        .error-state p {
          color: var(--color-text-secondary);
          margin-bottom: var(--space-6);
        }

        /* Guide Section */
        .guide-section {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          margin-bottom: var(--space-8);
          box-shadow: var(--shadow-card);
        }

        .guide-section h3 {
          font-size: var(--text-base);
          margin-bottom: var(--space-4);
        }

        .guide-steps {
          display: flex;
          gap: var(--space-3);
        }

        .guide-step {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-bg-hover);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .step-number {
          width: 24px;
          height: 24px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-xs);
          font-weight: 700;
          flex-shrink: 0;
        }

        /* History Section */
        .history-section {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          box-shadow: var(--shadow-card);
        }

        .history-section h3 {
          font-size: var(--text-base);
          margin-bottom: var(--space-4);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--color-bg-hover);
          border-radius: var(--radius-lg);
        }

        .history-icon {
          color: var(--color-text-muted);
        }

        .history-item.processed .history-icon {
          color: var(--color-success);
        }

        .history-item.failed .history-icon {
          color: var(--color-error);
        }

        .history-content {
          flex: 1;
          min-width: 0;
        }

        .history-name {
          display: block;
          font-weight: 500;
          font-size: var(--text-sm);
        }

        .history-meta {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .history-date {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .history-loading,
        .history-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          padding: var(--space-8);
          color: var(--color-text-muted);
        }

        @media (max-width: 768px) {
          .guide-steps {
            flex-direction: column;
          }

          .complete-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
