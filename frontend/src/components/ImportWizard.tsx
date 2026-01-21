import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, ExternalLink, Loader2 } from 'lucide-react';
import { validateFile, importFiles, trackEvent } from '../api';
import { useApp } from '../context/AppContext';

interface FileInfo {
  file: File;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'importing' | 'success' | 'error';
  reportType?: string;
  error?: string;
  warnings?: string[];
}

const REPORT_TYPES = {
  expanded_transactions: {
    name: 'Transactions Report',
    description: 'Incluye todos los cargos y pagos',
    antiquity: 'Hasta 3 años',
    required: true,
  },
  reservations_financials: {
    name: 'Reservations Report',
    description: 'Reservas con datos financieros',
    antiquity: 'Hasta 3 años',
    required: false,
  },
  channel_performance: {
    name: 'Channel Performance',
    description: 'Comisiones por canal',
    antiquity: 'Hasta 3 años',
    required: false,
  },
};

export default function ImportWizard() {
  const { property, refreshData } = useApp();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [step, setStep] = useState<'upload' | 'validate' | 'importing' | 'complete'>('upload');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.csv') || f.type === 'text/csv'
    );
    
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
  };

  const addFiles = async (newFiles: File[]) => {
    const fileInfos: FileInfo[] = newFiles.map((file) => ({
      file,
      status: 'validating',
    }));
    
    setFiles((prev) => [...prev, ...fileInfos]);
    setStep('validate');
    
    // Validate each file
    for (let i = 0; i < fileInfos.length; i++) {
      try {
        const result = await validateFile(fileInfos[i].file);
        
        setFiles((prev) => {
          const updated = [...prev];
          const idx = prev.findIndex((f) => f.file === fileInfos[i].file);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              status: result.success && result.data?.isValid ? 'valid' : 'invalid',
              reportType: result.data?.reportType,
              error: result.data?.missingRequired?.join(', '),
              warnings: result.data?.warnings,
            };
          }
          return updated;
        });
      } catch (err: any) {
        setFiles((prev) => {
          const updated = [...prev];
          const idx = prev.findIndex((f) => f.file === fileInfos[i].file);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              status: 'invalid',
              error: err.message,
            };
          }
          return updated;
        });
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStep('upload');
    }
  };

  const handleImport = async () => {
    if (!property) return;
    
    setStep('importing');
    trackEvent(property.id, 'import_started', { fileCount: files.length });
    
    const validFiles = files.filter((f) => f.status === 'valid');
    
    setFiles((prev) =>
      prev.map((f) => (f.status === 'valid' ? { ...f, status: 'importing' } : f))
    );
    
    try {
      const result = await importFiles(
        property.id,
        validFiles.map((f) => f.file)
      );
      
      setFiles((prev) =>
        prev.map((f, i) => {
          if (f.status !== 'importing') return f;
          const importResult = result.data?.results?.[i];
          return {
            ...f,
            status: importResult?.success ? 'success' : 'error',
            error: importResult?.errors?.join(', '),
            warnings: importResult?.warnings,
          };
        })
      );
      
      setStep('complete');
      await refreshData();
      
      trackEvent(property.id, result.success ? 'import_success' : 'import_failed', {
        results: result.data?.results,
      });
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) => (f.status === 'importing' ? { ...f, status: 'error', error: err.message } : f))
      );
      setStep('complete');
    }
  };

  const validCount = files.filter((f) => f.status === 'valid' || f.status === 'success').length;
  const hasRequired = files.some((f) => f.reportType === 'expanded_transactions' && f.status !== 'invalid');

  return (
    <div className="import-wizard">
      {/* Instructions panel */}
      <div className="import-instructions">
        <h4>Cómo exportar desde Cloudbeds</h4>
        <ol>
          <li>Abrí el reporte en Cloudbeds</li>
          <li>Si el reporte no muestra todo, hacé clic en "Run" o "Generar"</li>
          <li>Exportá como <strong>Table</strong> o <strong>Details Only</strong> en formato <strong>CSV</strong></li>
          <li>Subí el archivo aquí</li>
        </ol>
        <a
          href="https://myfrontdesk.cloudbeds.com/hc/en-us/articles/6979595895451-How-to-export-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="help-link"
        >
          Ver guía completa <ExternalLink size={14} />
        </a>
      </div>

      {/* Upload area */}
      <div
        className={`upload-dropzone ${dragActive ? 'active' : ''} ${files.length > 0 ? 'has-files' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          accept=".csv,text/csv"
          multiple
          onChange={handleFileSelect}
          className="file-input"
        />
        
        {files.length === 0 ? (
          <label htmlFor="file-input" className="upload-content">
            <div className="upload-icon">
              <Upload size={32} />
            </div>
            <div className="upload-text">
              <span className="upload-title">Arrastrá tus archivos CSV aquí</span>
              <span className="upload-subtitle">o hacé clic para seleccionar</span>
            </div>
            <div className="upload-formats">
              Formatos aceptados: CSV (Table o Details Only)
            </div>
          </label>
        ) : (
          <div className="files-list">
            {files.map((fileInfo, index) => (
              <div key={index} className={`file-item ${fileInfo.status}`}>
                <div className="file-icon">
                  {fileInfo.status === 'validating' || fileInfo.status === 'importing' ? (
                    <Loader2 size={20} className="spinner" />
                  ) : fileInfo.status === 'valid' || fileInfo.status === 'success' ? (
                    <CheckCircle size={20} />
                  ) : fileInfo.status === 'invalid' || fileInfo.status === 'error' ? (
                    <AlertCircle size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div className="file-info">
                  <span className="file-name">{fileInfo.file.name}</span>
                  <span className="file-meta">
                    {fileInfo.reportType && REPORT_TYPES[fileInfo.reportType as keyof typeof REPORT_TYPES]
                      ? REPORT_TYPES[fileInfo.reportType as keyof typeof REPORT_TYPES].name
                      : fileInfo.status === 'validating'
                      ? 'Validando...'
                      : fileInfo.status === 'importing'
                      ? 'Importando...'
                      : fileInfo.error || 'Tipo desconocido'}
                  </span>
                </div>
                {fileInfo.warnings && fileInfo.warnings.length > 0 && (
                  <span className="file-warnings" title={fileInfo.warnings.join('\n')}>
                    {fileInfo.warnings.length} advertencia{fileInfo.warnings.length > 1 ? 's' : ''}
                  </span>
                )}
                <button
                  className="file-remove"
                  onClick={() => removeFile(index)}
                  disabled={fileInfo.status === 'importing'}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            
            <label htmlFor="file-input" className="add-more-btn">
              <Upload size={16} />
              Agregar más archivos
            </label>
          </div>
        )}
      </div>

      {/* Required reports checklist */}
      <div className="reports-checklist">
        <h4>Reportes necesarios</h4>
        <div className="checklist-items">
          {Object.entries(REPORT_TYPES).map(([key, info]) => {
            const hasReport = files.some((f) => f.reportType === key && f.status !== 'invalid');
            return (
              <div key={key} className={`checklist-item ${hasReport ? 'complete' : ''}`}>
                <div className={`checklist-icon ${hasReport ? 'checked' : ''}`}>
                  {hasReport && <CheckCircle size={14} />}
                </div>
                <div className="checklist-content">
                  <span className="checklist-name">
                    {info.name}
                    {info.required && <span className="required-badge">Obligatorio</span>}
                  </span>
                  <span className="checklist-desc">{info.description} • <strong>{info.antiquity}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="import-actions">
        {step === 'complete' ? (
          <div className="import-success-celebration animate-fade-in">
            <div className="celebration-icon">
              <CheckCircle size={48} />
            </div>
            <h3>¡Datos actualizados con éxito! 🎉</h3>
            <p>Hemos procesado tus reportes y encontramos nuevos insights para tu hotel.</p>
            
            <div className="success-next-steps">
              <a href="/" className="btn btn-primary btn-lg">
                Ver mi Dashboard
                <ExternalLink size={18} />
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFiles([]);
                  setStep('upload');
                }}
              >
                Importar más archivos
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleImport}
            disabled={validCount === 0 || step === 'importing'}
          >
            {step === 'importing' ? (
              <>
                <Loader2 size={18} className="spinner" />
                Importando...
              </>
            ) : (
              <>
                Importar {validCount} archivo{validCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}
        
        {!hasRequired && files.length > 0 && (
          <p className="import-warning">
            <AlertCircle size={14} />
            Falta el reporte de Transacciones (obligatorio)
          </p>
        )}
      </div>

      <style>{`
        .import-wizard {
          max-width: 700px;
        }

        .import-instructions {
          background: var(--color-bg);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          margin-bottom: var(--space-6);
        }

        .import-instructions h4 {
          font-size: 0.9375rem;
          margin-bottom: var(--space-3);
        }

        .import-instructions ol {
          list-style-position: inside;
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          line-height: 1.8;
        }

        .import-instructions strong {
          color: var(--color-text);
        }

        .help-link {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          margin-top: var(--space-3);
          font-size: 0.875rem;
        }

        .upload-dropzone {
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-bg-card);
          transition: all var(--transition-fast);
          min-height: 200px;
        }

        .upload-dropzone.active {
          border-color: var(--color-primary);
          background: var(--color-primary-subtle);
        }

        .upload-dropzone.has-files {
          border-style: solid;
        }

        .file-input {
          display: none;
        }

        .upload-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-10);
          cursor: pointer;
          text-align: center;
        }

        .upload-icon {
          width: 64px;
          height: 64px;
          background: var(--color-primary-subtle);
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          margin-bottom: var(--space-4);
        }

        .upload-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          display: block;
        }

        .upload-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .upload-formats {
          margin-top: var(--space-4);
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        .files-list {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .file-item.valid,
        .file-item.success {
          border-color: var(--color-success);
          background: var(--color-primary-subtle);
        }

        .file-item.invalid,
        .file-item.error {
          border-color: var(--color-error);
          background: #fef2f2;
        }

        .file-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        .file-item.valid .file-icon,
        .file-item.success .file-icon {
          color: var(--color-success);
        }

        .file-item.invalid .file-icon,
        .file-item.error .file-icon {
          color: var(--color-error);
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-meta {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .file-item.invalid .file-meta,
        .file-item.error .file-meta {
          color: var(--color-error);
        }

        .file-warnings {
          font-size: 0.75rem;
          color: #b45309;
          background: #fef3c7;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
        }

        .file-remove {
          background: none;
          border: none;
          padding: var(--space-2);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .file-remove:hover {
          background: var(--color-bg-hover);
          color: var(--color-error);
        }

        .add-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .add-more-btn:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .reports-checklist {
          margin-top: var(--space-6);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
        }

        .reports-checklist h4 {
          font-size: 0.875rem;
          margin-bottom: var(--space-4);
        }

        .checklist-items {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .checklist-icon {
          width: 20px;
          height: 20px;
          border: 2px solid var(--color-border);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
          transition: all var(--transition-fast);
        }

        .checklist-icon.checked {
          background: var(--color-success);
          border-color: var(--color-success);
          color: white;
        }

        .checklist-content {
          flex: 1;
        }

        .checklist-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .required-badge {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-error);
          background: #fef2f2;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .checklist-desc {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .import-actions {
          margin-top: var(--space-6);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: var(--space-3);
        }

        .import-success-celebration {
          background: var(--color-bg-hover);
          border: 1px solid var(--color-success);
          border-radius: var(--radius-2xl);
          padding: var(--space-10);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
        }

        .celebration-icon {
          width: 80px;
          height: 80px;
          background: #dcfce7;
          color: var(--color-success);
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-2);
          box-shadow: 0 8px 24px rgba(22, 163, 74, 0.15);
        }

        .import-success-celebration h3 {
          font-size: var(--text-xl);
          font-weight: 800;
          color: var(--color-text);
          margin: 0;
        }

        .import-success-celebration p {
          font-size: var(--text-base);
          color: var(--color-text-secondary);
          max-width: 400px;
          margin: 0;
        }

        .success-next-steps {
          display: flex;
          gap: var(--space-4);
          margin-top: var(--space-6);
        }

        .import-warning {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.875rem;
          color: var(--color-warning);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

