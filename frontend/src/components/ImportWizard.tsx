import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, ExternalLink, Loader2, ArrowRight, Zap, Search, Filter, Download, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { validateFile, importFiles, trackEvent } from '../api';
import { useApp } from '../context/AppContext';
import styles from '../pages/Import.module.css';

interface FileInfo {
  file: File;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'importing' | 'success' | 'error';
  reportType?: string;
  error?: string;
  warnings?: string[];
  detectedCurrency?: string;
  currencyMismatch?: boolean;
}

const REPORT_TYPES = {
  expanded_transactions: {
    name: 'Expanded Transaction Report with Details',
    description: 'Incluye todos los cargos y pagos',
    antiquity: 'Hasta 3 años',
    required: true,
    searchTerm: 'Expanded Transaction Report with Details',
  },
  reservations_financials: {
    name: 'Reservations with Financials',
    description: 'Reservas con datos financieros',
    antiquity: 'Hasta 3 años',
    required: true,
    searchTerm: 'Reservations with Financials',
  },
};

// Cloudbeds reports base URL - users will need to be logged in
// The URL will redirect to their property automatically when logged in
const CLOUDBEDS_REPORTS_URL = 'https://hotels.cloudbeds.com/#/insights/cloudbeds-reports';
const getReportSearchUrl = (searchTerm: string) => {
  return `${CLOUDBEDS_REPORTS_URL}?search_term=${encodeURIComponent(searchTerm)}`;
};

interface ImportWizardProps {
  onComplete?: () => void;
  variant?: 'default' | 'onboarding';
}

export default function ImportWizard({ onComplete, variant = 'default' }: ImportWizardProps) {
  const { property, refreshData } = useApp();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [step, setStep] = useState<'upload' | 'validate' | 'importing' | 'complete'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [showInstructions, setShowInstructions] = useState(variant === 'onboarding');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
      (f) => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
    );
    
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, [files]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    e.target.value = '';
  };

  const addFiles = async (newFiles: File[]) => {
    const existingNames = files.map(f => f.file.name);
    const uniqueNewFiles = newFiles.filter(f => !existingNames.includes(f.name));
    
    if (uniqueNewFiles.length === 0) return;

    const fileInfos: FileInfo[] = uniqueNewFiles.map((file) => ({
      file,
      status: 'validating',
    }));
    
    setFiles((prev) => [...prev, ...fileInfos]);
    setStep('validate');
    
    for (const fileInfo of fileInfos) {
      try {
        const result = await validateFile(fileInfo.file);
        
        const detectedCurrency = result.data?.detectedCurrency;
        const propertyCurrency = property?.currency || 'ARS';
        const currencyMismatch = detectedCurrency && 
          detectedCurrency !== 'unknown' && 
          detectedCurrency !== propertyCurrency;
        
        setFiles((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((f) => f.file.name === fileInfo.file.name);
          if (idx !== -1) {
            const isValid = result.success && result.data?.isValid && !currencyMismatch;
            
            updated[idx] = {
              ...updated[idx],
              status: isValid ? 'valid' : 'invalid',
              reportType: result.data?.reportType,
              error: currencyMismatch 
                ? `⚠️ MONEDA INCORRECTA: El archivo parece estar en ${detectedCurrency} pero tu propiedad está configurada en ${propertyCurrency}. Esto causaría análisis incorrectos.`
                : result.data?.missingRequired?.join(', ') || result.error,
              warnings: result.data?.warnings,
              detectedCurrency,
              currencyMismatch,
            };
          }
          return updated;
        });
      } catch (err: any) {
        setFiles((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((f) => f.file.name === fileInfo.file.name);
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
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
      setStep('upload');
    }
      return updated;
    });
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
        prev.map((f) => {
          if (f.status !== 'importing') return f;
          
          const importResult = result.data?.results?.find((r: any) => r.filename === f.file.name || r.reportType === f.reportType);
          const isFileSuccess = importResult?.success || (result.success && !importResult?.error);
          
          return {
            ...f,
            status: isFileSuccess ? 'success' : 'error',
            error: importResult?.error || (importResult?.errors && importResult.errors.join(', ')) || result.error,
            warnings: importResult?.warnings,
          };
        })
      );
      
      // Solo pasar a 'complete' si al menos un archivo tuvo éxito
      const anySuccess = result.success || (result.data?.results?.some((r: any) => r.success));
      if (anySuccess) {
        setStep('complete');
        await refreshData();
      } else {
        setStep('validate'); // Volver a validación para que el usuario vea los errores
      }
      
      trackEvent(property.id, result.success ? 'import_success' : 'import_failed', {
        results: result.data?.results,
      });
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) => (f.status === 'importing' ? { ...f, status: 'error', error: err.message } : f))
      );
      setStep('validate');
    }
  };

  const validCount = files.filter((f) => f.status === 'valid' || f.status === 'success').length;
  
  // Requirement logic: Onboarding requires both reports.
  const isOnboarding = variant === 'onboarding';
  const hasTransactions = files.some((f) => f.reportType === 'expanded_transactions' && (f.status === 'valid' || f.status === 'success'));
  const hasReservations = files.some((f) => f.reportType === 'reservations_financials' && (f.status === 'valid' || f.status === 'success'));
  const hasRequired = !isOnboarding || (hasTransactions && hasReservations);

  return (
    <div className={`${styles.importWizard} ${variant === 'onboarding' ? styles.onboardingVariant : ''}`}>
      
      {/* Instructions Section */}
      <div className={styles.instructionsSection}>
        <button 
          className={styles.instructionsToggle}
          onClick={() => setShowInstructions(!showInstructions)}
          type="button"
        >
          <div className={styles.instructionsToggleContent}>
            <Search size={18} />
            <span>¿Cómo encuentro los reportes en Cloudbeds?</span>
          </div>
          {showInstructions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showInstructions && (
          <div className={styles.instructionsContent}>
            {/* Step 1: Find Reports */}
            <div className={styles.instructionStep}>
              <div className={styles.instructionStepNumber}>1</div>
              <div className={styles.instructionStepContent}>
                <h4>Buscá los reportes en Cloudbeds</h4>
                <p>Andá a <strong>Cloudbeds Reports</strong> y buscá cada reporte por su nombre:</p>
                
                <div className={styles.reportLinks}>
                  {Object.entries(REPORT_TYPES).map(([key, info]) => (
                    <div key={key} className={styles.reportLinkItem}>
                      <div className={styles.reportLinkInfo}>
                        <span className={styles.reportLinkName}>{info.searchTerm}</span>
                      </div>
                      <div className={styles.reportLinkActions}>
                        <a 
                          href={getReportSearchUrl(info.searchTerm)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.reportLinkBtn}
                        >
                          <ExternalLink size={14} />
                          Abrir
                        </a>
                        <button
                          type="button"
                          className={styles.reportCopyBtn}
                          onClick={() => copyToClipboard(info.searchTerm, key)}
                          title="Copiar nombre"
                        >
                          {copiedLink === key ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Configure Filters */}
            <div className={styles.instructionStep}>
              <div className={styles.instructionStepNumber}>2</div>
              <div className={styles.instructionStepContent}>
                <h4>Configurá los filtros de fecha</h4>
                <p>En cada reporte, agregá estos dos filtros en <strong>"Check-In Date"</strong>:</p>
                
                <div className={styles.filterConfig}>
                  <div className={styles.filterItem}>
                    <Filter size={16} />
                    <div className={styles.filterDetails}>
                      <span className={styles.filterField}>Check-In Date</span>
                      <span className={styles.filterOperator}>mayor o igual a</span>
                      <span className={styles.filterValue}>3 Años Antes De Hoy</span>
                    </div>
                  </div>
                  <div className={styles.filterItem}>
                    <Filter size={16} />
                    <div className={styles.filterDetails}>
                      <span className={styles.filterField}>Check-In Date</span>
                      <span className={styles.filterOperator}>menor o igual a</span>
                      <span className={styles.filterValue}>3 Años Después De Hoy</span>
                    </div>
                  </div>
                </div>

                <div className={styles.filterTip}>
                  <Zap size={14} />
                  <span>Esto garantiza que tengas suficiente historial para análisis precisos</span>
                </div>
              </div>
            </div>

            {/* Step 3: Export */}
            <div className={styles.instructionStep}>
              <div className={styles.instructionStepNumber}>3</div>
              <div className={styles.instructionStepContent}>
                <h4>Exportá como CSV</h4>
                <p>Hacé clic en <strong>"Export"</strong> y seleccioná:</p>
                <ul className={styles.exportOptions}>
                  <li>
                    <Download size={14} />
                    <span>Formato: <strong>CSV</strong></span>
                  </li>
                  <li>
                    <CheckCircle size={14} />
                    <span>Vista: <strong>"Table"</strong> o <strong>"Details Only"</strong></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''} ${files.length > 0 ? styles.dropzoneHasFiles : ''}`}
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
          className={styles.fileInput}
        />
        
        {files.length === 0 ? (
          <label htmlFor="file-input" className={styles.dropzoneContent}>
            <div className={styles.dropzoneIcon}>
              <Upload size={32} />
            </div>
            <div className={styles.dropzoneTitle}>Arrastrá tus archivos CSV aquí</div>
            <div className={styles.dropzoneSubtitle}>o hacé clic para seleccionar</div>
          </label>
        ) : (
          <div className={styles.filesList}>
            {files.map((fileInfo, index) => (
              <div key={index} className={`${styles.fileItem} ${styles[fileInfo.status]}`}>
                <div className={styles.fileIcon}>
                  {fileInfo.status === 'validating' || fileInfo.status === 'importing' ? (
                    <Loader2 size={20} className={styles.spin} />
                  ) : fileInfo.status === 'valid' || fileInfo.status === 'success' ? (
                    <CheckCircle size={20} />
                  ) : fileInfo.status === 'invalid' || fileInfo.status === 'error' ? (
                    <AlertCircle size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{fileInfo.file.name}</span>
                  <span className={styles.fileMeta}>
                    {fileInfo.currencyMismatch
                      ? fileInfo.error
                      : fileInfo.reportType && REPORT_TYPES[fileInfo.reportType as keyof typeof REPORT_TYPES]
                      ? REPORT_TYPES[fileInfo.reportType as keyof typeof REPORT_TYPES].name
                      : fileInfo.status === 'validating'
                      ? 'Validando...'
                      : fileInfo.status === 'importing'
                      ? 'Importando...'
                      : fileInfo.error || 'Tipo desconocido'}
                  </span>
                </div>
                {fileInfo.warnings && fileInfo.warnings.length > 0 && (
                  <span className={styles.badge} style={{ background: '#fef3c7', color: '#b45309' }}>
                    {fileInfo.warnings.length} advertencia{fileInfo.warnings.length > 1 ? 's' : ''}
                  </span>
                )}
                <button
                  className={styles.fileRemove}
                  onClick={() => removeFile(index)}
                  disabled={fileInfo.status === 'importing'}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            
            <label htmlFor="file-input" className={styles.addMoreBtn}>
              <Upload size={16} />
              Agregar más archivos
            </label>
          </div>
        )}
      </div>

      <div className={styles.reportChecklist}>
        <h4>Reportes necesarios</h4>
        <div className={styles.checklistItems}>
          {Object.entries(REPORT_TYPES).map(([key, info]) => {
            const hasReport = files.some((f) => f.reportType === key && (f.status === 'valid' || f.status === 'success'));
            const isRequiredForThisVariant = variant === 'onboarding' ? info.required : false;
            
            return (
              <div key={key} className={`${styles.checklistItem} ${hasReport ? styles.complete : ''}`}>
                <div className={styles.checklistIcon}>
                  {hasReport ? <CheckCircle size={18} /> : <div className={styles.checkNumber}>{Object.keys(REPORT_TYPES).indexOf(key) + 1}</div>}
                </div>
                <div className={styles.checklistContent}>
                  <strong>
                    {info.name}
                    {isRequiredForThisVariant && <span className={styles.badge} style={{ marginLeft: '8px', background: '#fee2e2', color: '#ef4444' }}>Obligatorio</span>}
                  </strong>
                  <span>{info.description} • {info.antiquity}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.stepActions} style={{ marginTop: 'var(--space-6)' }}>
        {step === 'complete' ? (
          <div className={styles.completeState} style={{ width: '100%' }}>
            <div className={styles.completeIcon}>
              <CheckCircle size={48} />
            </div>
            <h3>¡Datos actualizados con éxito! 🎉</h3>
            <p>Hemos procesado tus reportes y encontramos nuevos insights para tu hotel.</p>
            
            <div className={styles.completeActions}>
              {onComplete ? (
                <button onClick={onComplete} className={styles.btnPrimary}>
                  Continuar
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button onClick={() => window.location.href = '/'} className={styles.btnPrimary}>
                Ver mi Dashboard
                  <ArrowRight size={18} />
                </button>
              )}
              <button
                className={styles.btnSecondary}
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
            className={styles.btnPrimary}
            onClick={handleImport}
            disabled={validCount === 0 || step === 'importing' || !hasRequired}
            style={{ width: variant === 'onboarding' ? '100%' : 'auto' }}
          >
            {step === 'importing' ? (
              <>
                <Loader2 size={18} className={styles.spin} />
                Importando...
              </>
            ) : (
              <>
                Importar {validCount} archivo{validCount !== 1 ? 's' : ''}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        )}
      </div>

      {!hasRequired && files.length > 0 && step !== 'complete' && (
        <div className={styles.warningBox}>
          <AlertCircle size={14} />
          <span>Faltan reportes obligatorios para configurar tu cuenta ({!hasTransactions ? 'Transacciones' : ''}{!hasTransactions && !hasReservations ? ' y ' : ''}{!hasReservations ? 'Reservas' : ''})</span>
        </div>
      )}
    </div>
  );
}
