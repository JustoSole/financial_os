import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  ArrowRight,
  FileUp,
  Loader2,
  FileText,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getImportHistory, importFiles, validateFile, trackEvent } from '../api';
import styles from './Import.module.css';

type ImportStep = 'upload' | 'validating' | 'importing' | 'complete' | 'error';

interface FileInfo {
  file: File;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'importing' | 'success' | 'error';
  reportType?: string;
  error?: string;
}

const REPORT_INFO = {
  expanded_transactions: {
    name: 'Transacciones',
    icon: '💳',
    description: 'Todos los cargos y pagos'
  },
  reservations_financials: {
    name: 'Reservas',
    icon: '📅',
    description: 'Reservas con financieros'
  },
  channel_performance: {
    name: 'Canales',
    icon: '📊',
    description: 'Performance por canal'
  }
};

export default function Import() {
  const { property, refreshData } = useApp();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ImportStep>('upload');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [dragActive, setDragActive] = useState(false);

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
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
    );
    if (droppedFiles.length > 0) addFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const addFiles = async (newFiles: File[]) => {
    const existingNames = files.map(f => f.file.name);
    const uniqueNewFiles = newFiles.filter(f => !existingNames.includes(f.name));
    
    const fileInfos: FileInfo[] = uniqueNewFiles.map(file => ({
      file,
      status: 'validating'
    }));
    
    setFiles(prev => [...prev, ...fileInfos]);
    
    for (const fileInfo of fileInfos) {
      try {
        const result = await validateFile(fileInfo.file);
        setFiles(prev => prev.map(f => {
          if (f.file.name === fileInfo.file.name) {
            return {
              ...f,
              status: result.success && result.data?.isValid ? 'valid' : 'invalid',
              reportType: result.data?.reportType,
              error: result.data?.missingRequired?.join(', ') || result.error
            };
          }
          return f;
        }));
      } catch (err: any) {
        setFiles(prev => prev.map(f => {
          if (f.file.name === fileInfo.file.name) {
            return { ...f, status: 'invalid', error: err.message };
          }
          return f;
        }));
      }
    }
  };

  const removeFile = (filename: string) => {
    setFiles(prev => prev.filter(f => f.file.name !== filename));
  };

  const handleImport = async () => {
    if (!property?.id) return;
    
    setStep('importing');
    trackEvent(property.id, 'import_started', { fileCount: files.length });
    
    const validFiles = files.filter(f => f.status === 'valid');
    
    setFiles(prev => prev.map(f => 
      f.status === 'valid' ? { ...f, status: 'importing' } : f
    ));
    
    try {
      await importFiles(property.id, validFiles.map(f => f.file));
      
      setFiles(prev => prev.map(f => {
        if (f.status === 'importing') {
          return { ...f, status: 'success' };
        }
        return f;
      }));
      
      setStep('complete');
      await refreshData();
      loadHistory();
      trackEvent(property.id, 'import_success');
    } catch (err: any) {
      console.error('Import error:', err);
      setStep('error');
      setFiles(prev => prev.map(f => 
        f.status === 'importing' ? { ...f, status: 'error', error: err.message } : f
      ));
      trackEvent(property.id, 'import_failed');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFiles([]);
  };

  const reportNames: Record<string, string> = {
    expanded_transactions: 'Transacciones',
    reservations_financials: 'Reservas',
    channel_performance: 'Canales',
    unknown: 'Desconocido',
  };

  const validFilesCount = files.filter(f => f.status === 'valid' || f.status === 'success').length;
  const hasTransactions = files.some(f => f.reportType === 'expanded_transactions' && f.status !== 'invalid');
  
  const reportStatus = {
    transactions: files.find(f => f.reportType === 'expanded_transactions'),
    reservations: files.find(f => f.reportType === 'reservations_financials'),
    channels: files.find(f => f.reportType === 'channel_performance')
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
        {step === 'upload' && (
          <>
            <div
              className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''} ${files.length > 0 ? styles.dropzoneHasFiles : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                accept=".csv,text/csv"
                multiple
                onChange={handleFileInput}
                className={styles.fileInput}
              />
              
              {files.length === 0 ? (
                <label htmlFor="file-upload" className={styles.dropzoneContent}>
                  <div className={styles.dropzoneIcon}>
                    <Upload size={32} />
                  </div>
                  <span className={styles.dropzoneTitle}>
                    Arrastrá tus archivos CSV aquí
                  </span>
                  <span className={styles.dropzoneSubtitle}>
                    o hacé clic para seleccionar
                  </span>
                </label>
              ) : (
                <div className={styles.filesList}>
                  {files.map(f => (
                    <div 
                      key={f.file.name} 
                      className={`${styles.fileItem} ${styles[f.status]}`}
                    >
                      <div className={styles.fileIcon}>
                        {f.status === 'validating' || f.status === 'importing' ? (
                          <Loader2 size={20} className={styles.spin} />
                        ) : f.status === 'valid' || f.status === 'success' ? (
                          <CheckCircle size={20} />
                        ) : f.status === 'invalid' || f.status === 'error' ? (
                          <AlertCircle size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{f.file.name}</span>
                        <span className={styles.fileMeta}>
                          {f.reportType && REPORT_INFO[f.reportType as keyof typeof REPORT_INFO]
                            ? `${REPORT_INFO[f.reportType as keyof typeof REPORT_INFO].icon} ${REPORT_INFO[f.reportType as keyof typeof REPORT_INFO].name}`
                            : f.status === 'validating' ? 'Analizando...'
                            : f.status === 'importing' ? 'Importando...'
                            : f.error || 'Archivo no reconocido'
                          }
                        </span>
                      </div>
                      {f.status !== 'importing' && f.status !== 'success' && (
                        <button 
                          className={styles.fileRemove}
                          onClick={() => removeFile(f.file.name)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <label htmlFor="file-upload" className={styles.addMoreBtn}>
                    <Upload size={16} />
                    Agregar más archivos
                  </label>
                </div>
              )}
            </div>

            <div className={styles.reportChecklist}>
              <h4>Archivos recomendados:</h4>
              <div className={styles.checklistItems}>
                <div className={`${styles.checklistItem} ${reportStatus.transactions?.status === 'valid' || reportStatus.transactions?.status === 'success' ? styles.complete : ''}`}>
                  <div className={styles.checklistIcon}>
                    {reportStatus.transactions?.status === 'valid' || reportStatus.transactions?.status === 'success' ? (
                      <CheckCircle size={18} />
                    ) : (
                      <span className={styles.checkNumber}>1</span>
                    )}
                  </div>
                  <div className={styles.checklistContent}>
                    <strong>Expanded Transaction Report with Details</strong>
                    <span>Reportes → Expanded Transaction Report</span>
                  </div>
                </div>
                
                <div className={`${styles.checklistItem} ${reportStatus.reservations?.status === 'valid' || reportStatus.reservations?.status === 'success' ? styles.complete : ''}`}>
                  <div className={styles.checklistIcon}>
                    {reportStatus.reservations?.status === 'valid' || reportStatus.reservations?.status === 'success' ? (
                      <CheckCircle size={18} />
                    ) : (
                      <span className={styles.checkNumber}>2</span>
                    )}
                  </div>
                  <div className={styles.checklistContent}>
                    <strong>Reservations with Financials</strong>
                    <span>Reportes → Reservations with Financials</span>
                  </div>
                </div>
                
                <div className={`${styles.checklistItem} ${reportStatus.channels?.status === 'valid' || reportStatus.channels?.status === 'success' ? styles.complete : ''}`}>
                  <div className={styles.checklistIcon}>
                    {reportStatus.channels?.status === 'valid' || reportStatus.channels?.status === 'success' ? (
                      <CheckCircle size={18} />
                    ) : (
                      <span className={styles.checkNumber}>3</span>
                    )}
                  </div>
                  <div className={styles.checklistContent}>
                    <strong>Channel Performance Summary</strong>
                    <span>Reportes → Channel Performance Summary</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.checklistTip}>
                <Zap size={14} />
                <span>Exportá cada reporte como <strong>CSV</strong> con vista <strong>"Table"</strong> o <strong>"Details Only"</strong></span>
              </div>
            </div>

            <div className={styles.stepActions}>
              <button 
                className={styles.btnPrimary}
                onClick={handleImport}
                disabled={validFilesCount === 0}
              >
                Importar {validFilesCount} archivo{validFilesCount !== 1 ? 's' : ''}
                <ArrowRight size={18} />
              </button>
            </div>

            {!hasTransactions && files.length > 0 && (
              <div className={styles.warningBox}>
                <AlertCircle size={16} />
                <span>Se recomienda incluir el reporte de <strong>Transacciones</strong> para datos actualizados</span>
              </div>
            )}
          </>
        )}

        {(step === 'importing') && (
          <div className={styles.processingState}>
            <div className={styles.spinContainer}>
              <Loader2 size={48} className={styles.spin} />
            </div>
            <h3>Importando datos...</h3>
            <p>Estamos procesando tus archivos de Cloudbeds. Esto puede tardar unos segundos dependiendo del tamaño de los reportes.</p>
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarFill} />
            </div>
            <div className={styles.selectedFilesList}>
              {files.filter(f => f.status === 'importing' || f.status === 'success').map(f => (
                <div key={f.file.name} className={styles.selectedFileItem}>
                  {f.status === 'success' ? '✅' : '⏳'} {f.file.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className={styles.completeState}>
            <div className={styles.completeIcon}>
              <CheckCircle size={48} />
            </div>
            <h2>¡Importación completada!</h2>
            <p>Tus datos han sido actualizados correctamente.</p>

            <div className={styles.completeActions}>
              <button onClick={() => window.location.href = '/'} className={styles.btnPrimary}>
                Ver dashboard
                <ArrowRight size={18} />
              </button>
              <button onClick={resetImport} className={styles.btnSecondary}>
                Subir más
              </button>
            </div>
          </div>
        )}

        {(step === 'error' || step === 'error') && (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>
              <AlertCircle size={48} />
            </div>
            <h3>Problemas con la importación</h3>
            <p>Hubo un error al procesar algunos archivos.</p>
            <div className={styles.errorFileList}>
              {files.map(f => (
                <div key={f.file.name} className={styles.errorFileItem}>
                  <strong>{f.file.name}:</strong>
                  <span className={f.status === 'error' || f.status === 'invalid' ? styles.textError : styles.textSuccess}>
                    {f.status === 'error' || f.status === 'invalid' ? `❌ ${f.error || 'Error'}` : '✅ OK'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={resetImport} className={styles.btnPrimary}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div className={styles.historySection}>
        <h3 className={styles.sectionTitle}>Historial de importaciones</h3>
        {loading ? (
          <div className={styles.historyLoading}>Cargando historial...</div>
        ) : history.length > 0 ? (
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

