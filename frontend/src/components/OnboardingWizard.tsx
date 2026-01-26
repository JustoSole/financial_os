import { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle, 
  FileText, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  DollarSign,
  Building2,
  Loader2,
  X,
  AlertCircle,
  TrendingUp,
  Zap,
  Bed
} from 'lucide-react';
import { validateFile, importFiles, updateCosts, trackEvent, getCosts } from '../api';
import { useApp } from '../context/AppContext';
import { markOnboardingCompleted } from '../utils/onboarding';
import styles from './OnboardingWizard.module.css';

type WizardStep = 'welcome' | 'upload' | 'costs' | 'complete';

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

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { property, refreshData, refreshProperty } = useApp();
  const [step, setStep] = useState<WizardStep>('welcome');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  
  // Costs state - simplified
  const [roomCount, setRoomCount] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [cleaningCost, setCleaningCost] = useState(0);
  const [monthlySalaries, setMonthlySalaries] = useState(0);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [monthlyUtilities, setMonthlyUtilities] = useState(0);
  const [savingCosts, setSavingCosts] = useState(false);

  // Load existing costs if any
  useEffect(() => {
    if (property?.id && step === 'costs') {
      loadExistingCosts();
    }
  }, [property?.id, step]);

  const loadExistingCosts = async () => {
    if (!property?.id) return;
    try {
      const res = await getCosts(property.id);
      if (res.success && res.data) {
        setRoomCount(res.data.room_count || 0);
        setCashBalance(res.data.starting_cash_balance || 0);
        if (res.data.variable_costs?.cleaningPerStay) {
          setCleaningCost(res.data.variable_costs.cleaningPerStay);
        }
        if (res.data.fixed_categories) {
          const salaries = res.data.fixed_categories.find((c: any) => c.id === 'salaries');
          const rent = res.data.fixed_categories.find((c: any) => c.id === 'rent');
          const utilities = res.data.fixed_categories.find((c: any) => c.id === 'utilities');
          if (salaries) setMonthlySalaries(salaries.monthlyAmount || 0);
          if (rent) setMonthlyRent(rent.monthlyAmount || 0);
          if (utilities) setMonthlyUtilities(utilities.monthlyAmount || 0);
        }
      }
    } catch (e) {
      console.error('Error loading costs:', e);
    }
  };

  // File handling
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
      f => f.name.endsWith('.csv') || f.type === 'text/csv'
    );
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      addFiles(selected);
    }
    // Reset input
    e.target.value = '';
  };

  const addFiles = async (newFiles: File[]) => {
    // Filter out duplicates
    const existingNames = files.map(f => f.file.name);
    const uniqueNewFiles = newFiles.filter(f => !existingNames.includes(f.name));
    
    const fileInfos: FileInfo[] = uniqueNewFiles.map(file => ({
      file,
      status: 'validating'
    }));
    
    setFiles(prev => [...prev, ...fileInfos]);
    
    // Validate each file
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
    
    setIsImporting(true);
    trackEvent(property.id, 'onboarding_import_started', { fileCount: files.length });
    
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
      
      setImportComplete(true);
      await refreshData();
      trackEvent(property.id, 'onboarding_import_success');
    } catch (err: any) {
      setFiles(prev => prev.map(f => 
        f.status === 'importing' ? { ...f, status: 'error', error: err.message } : f
      ));
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveCosts = async () => {
    if (!property?.id) return;
    
    setSavingCosts(true);
    
    try {
      const costsData = {
        roomCount,
        startingCashBalance: cashBalance,
        cleaningPerStay: cleaningCost,
        fixedCategories: [
          { id: 'salaries', name: 'Sueldos', monthlyAmount: monthlySalaries },
          { id: 'rent', name: 'Alquiler', monthlyAmount: monthlyRent },
          { id: 'utilities', name: 'Servicios (luz, gas, agua)', monthlyAmount: monthlyUtilities },
        ].filter(c => c.monthlyAmount > 0),
        variableCategories: []
      };
      
      await updateCosts(property.id, costsData);
      trackEvent(property.id, 'onboarding_costs_saved');
      setStep('complete');
    } catch (err) {
      console.error('Error saving costs:', err);
    } finally {
      setSavingCosts(false);
    }
  };

  const handleComplete = async () => {
    if (property?.id) {
      markOnboardingCompleted(property.id);
      trackEvent(property.id, 'onboarding_complete');
    }
    
    // Ensure state is updated before calling onComplete
    // This helps prevent the Home component from seeing an old state
    setTimeout(async () => {
      await refreshProperty();
      await refreshData();
      onComplete();
    }, 100);
  };
  
  const handleSkipWithDemo = () => {
    if (property?.id) {
      markOnboardingCompleted(property.id);
      trackEvent(property.id, 'onboarding_skipped_demo');
    }
    onComplete();
  };

  const validFilesCount = files.filter(f => f.status === 'valid' || f.status === 'success').length;
  const hasTransactions = files.some(f => f.reportType === 'expanded_transactions' && f.status !== 'invalid');
  
  // Check which reports we have
  const reportStatus = {
    transactions: files.find(f => f.reportType === 'expanded_transactions'),
    reservations: files.find(f => f.reportType === 'reservations_financials'),
    channels: files.find(f => f.reportType === 'channel_performance')
  };

  const totalFixedCosts = monthlySalaries + monthlyRent + monthlyUtilities;
  const currency = property?.currency || 'ARS';

  const formatNumber = (n: number) => {
    return n.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR');
  };

  const parseNumber = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  return (
    <div className={styles.wizard}>
      {/* Progress indicator */}
      <div className={styles.progress}>
        <div className={styles.progressSteps}>
          {['welcome', 'upload', 'costs', 'complete'].map((s, i) => (
            <div 
              key={s} 
              className={`${styles.progressStep} ${
                step === s ? styles.active : 
                ['welcome', 'upload', 'costs', 'complete'].indexOf(step) > i ? styles.completed : ''
              }`}
            >
              <div className={styles.progressDot}>
                {['welcome', 'upload', 'costs', 'complete'].indexOf(step) > i ? (
                  <CheckCircle size={16} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={styles.progressLabel}>
                {s === 'welcome' && 'Inicio'}
                {s === 'upload' && 'Datos'}
                {s === 'costs' && 'Costos'}
                {s === 'complete' && 'Listo'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step: Welcome */}
      {step === 'welcome' && (
        <div className={styles.stepContent}>
          <div className={styles.welcomeHero}>
            <div className={styles.welcomeIcon}>
              <Sparkles size={48} />
            </div>
            <h1 className={styles.welcomeTitle}>
              Bienvenido a Financial OS
            </h1>
            <p className={styles.welcomeSubtitle}>
              Conocé la <strong>rentabilidad real</strong> de tu hotel en minutos.
              <br />Solo necesitamos 3 archivos de Cloudbeds.
            </p>
          </div>

          <div className={styles.welcomeSteps}>
            <div className={styles.welcomeStep}>
              <div className={styles.welcomeStepIcon}>
                <Upload size={24} />
              </div>
              <div className={styles.welcomeStepContent}>
                <h3>1. Subí tus reportes</h3>
                <p>3 archivos CSV exportados de Cloudbeds</p>
              </div>
            </div>
            <div className={styles.welcomeStep}>
              <div className={styles.welcomeStepIcon}>
                <DollarSign size={24} />
              </div>
              <div className={styles.welcomeStepContent}>
                <h3>2. Agregá tus costos</h3>
                <p>Sueldos, alquiler y gastos básicos</p>
              </div>
            </div>
            <div className={styles.welcomeStep}>
              <div className={styles.welcomeStepIcon}>
                <TrendingUp size={24} />
              </div>
              <div className={styles.welcomeStepContent}>
                <h3>3. Descubrí tu profit real</h3>
                <p>Ganancia neta por reserva y canal</p>
              </div>
            </div>
          </div>

          <div className={styles.welcomeTime}>
            <Zap size={16} />
            <span>Tiempo estimado: <strong>3 minutos</strong></span>
          </div>

          <button 
            className={styles.btnPrimary}
            onClick={() => setStep('upload')}
          >
            Empezar configuración
            <ArrowRight size={20} />
          </button>

          <button 
            className={styles.btnDemo}
            onClick={handleSkipWithDemo}
          >
            Explorar con datos demo →
          </button>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h2>Subí tus reportes de Cloudbeds</h2>
            <p>Necesitamos estos 3 archivos CSV para calcular tu rentabilidad real</p>
          </div>

          {/* Dropzone */}
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
              onChange={handleFileSelect}
              className={styles.fileInput}
            />
            
            {files.length === 0 ? (
              <label htmlFor="file-upload" className={styles.dropzoneContent}>
                <div className={styles.dropzoneIcon}>
                  <Upload size={32} />
                </div>
                <span className={styles.dropzoneTitle}>
                  Arrastrá los 3 archivos CSV aquí
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

          {/* Report checklist */}
          <div className={styles.reportChecklist}>
            <h4>Archivos requeridos:</h4>
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

          {/* Actions */}
          <div className={styles.stepActions}>
            <button 
              className={styles.btnSecondary}
              onClick={() => setStep('welcome')}
            >
              <ArrowLeft size={18} />
              Volver
            </button>
            
            {!importComplete ? (
              <button 
                className={styles.btnPrimary}
                onClick={handleImport}
                disabled={validFilesCount === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 size={18} className={styles.spin} />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar {validFilesCount} archivo{validFilesCount !== 1 ? 's' : ''}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            ) : (
              <button 
                className={styles.btnPrimary}
                onClick={() => setStep('costs')}
              >
                Configurar costos
                <ArrowRight size={18} />
              </button>
            )}
          </div>

          {!hasTransactions && files.length > 0 && (
            <div className={styles.warningBox}>
              <AlertCircle size={16} />
              <span>Necesitás al menos el reporte de <strong>Transacciones</strong> para continuar</span>
            </div>
          )}
        </div>
      )}

      {/* Step: Costs */}
      {step === 'costs' && (
        <div className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h2>Configurá tus costos básicos</h2>
            <p>Estos datos nos permiten calcular tu ganancia neta real por reserva</p>
          </div>

          <div className={styles.costsForm}>
            {/* Room Count */}
            <div className={styles.costSection}>
              <div className={styles.costSectionHeader}>
                <Bed size={20} />
                <div>
                  <h3>Cantidad de habitaciones</h3>
                  <p>Total de habitaciones disponibles para vender</p>
                </div>
              </div>
              <div className={styles.costInput}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={roomCount > 0 ? roomCount.toString() : ''}
                  onChange={(e) => setRoomCount(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                  placeholder="0"
                  style={{ textAlign: 'center', maxWidth: '100px' }}
                />
                <span className={styles.costSuffix}>habitaciones</span>
              </div>
            </div>

            {/* Cash Balance */}
            <div className={styles.costSection}>
              <div className={styles.costSectionHeader}>
                <DollarSign size={20} />
                <div>
                  <h3>Saldo de caja actual</h3>
                  <p>Efectivo + bancos disponible hoy</p>
                </div>
              </div>
              <div className={styles.costInput}>
                <span className={styles.currencySymbol}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashBalance > 0 ? formatNumber(cashBalance) : ''}
                  onChange={(e) => setCashBalance(parseNumber(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cleaning Cost */}
            <div className={styles.costSection}>
              <div className={styles.costSectionHeader}>
                <Sparkles size={20} />
                <div>
                  <h3>Costo de limpieza por estadía</h3>
                  <p>¿Cuánto cuesta limpiar después de cada check-out?</p>
                </div>
              </div>
              <div className={styles.costInput}>
                <span className={styles.currencySymbol}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cleaningCost > 0 ? formatNumber(cleaningCost) : ''}
                  onChange={(e) => setCleaningCost(parseNumber(e.target.value))}
                  placeholder="0"
                />
                <span className={styles.costSuffix}>/estadía</span>
              </div>
            </div>

            {/* Fixed Costs */}
            <div className={styles.costSection}>
              <div className={styles.costSectionHeader}>
                <Building2 size={20} />
                <div>
                  <h3>Costos fijos mensuales</h3>
                  <p>Gastos que pagás todos los meses</p>
                </div>
              </div>
              
              <div className={styles.costGrid}>
                <div className={styles.costGridItem}>
                  <label>Sueldos</label>
                  <div className={styles.costInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlySalaries > 0 ? formatNumber(monthlySalaries) : ''}
                      onChange={(e) => setMonthlySalaries(parseNumber(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className={styles.costGridItem}>
                  <label>Alquiler</label>
                  <div className={styles.costInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyRent > 0 ? formatNumber(monthlyRent) : ''}
                      onChange={(e) => setMonthlyRent(parseNumber(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className={styles.costGridItem}>
                  <label>Servicios (luz, gas, agua)</label>
                  <div className={styles.costInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyUtilities > 0 ? formatNumber(monthlyUtilities) : ''}
                      onChange={(e) => setMonthlyUtilities(parseNumber(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {totalFixedCosts > 0 && (
                <div className={styles.costSummary}>
                  <span>Total costos fijos:</span>
                  <strong>${formatNumber(totalFixedCosts)}/mes</strong>
                </div>
              )}
            </div>
          </div>

          <div className={styles.costsNote}>
            <Zap size={14} />
            <span>Podés ajustar estos valores y agregar más categorías después en <strong>Configuración → Costos</strong></span>
          </div>

          <div className={styles.stepActions}>
            <button 
              className={styles.btnSecondary}
              onClick={() => setStep('upload')}
            >
              <ArrowLeft size={18} />
              Volver
            </button>
            
            <button 
              className={styles.btnPrimary}
              onClick={handleSaveCosts}
              disabled={savingCosts}
            >
              {savingCosts ? (
                <>
                  <Loader2 size={18} className={styles.spin} />
                  Guardando...
                </>
              ) : (
                <>
                  Guardar y ver dashboard
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          <button 
            className={styles.skipBtn}
            onClick={() => setStep('complete')}
          >
            Configurar después →
          </button>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className={styles.stepContent}>
          <div className={styles.completeHero}>
            <div className={styles.completeIcon}>
              <CheckCircle size={64} />
            </div>
            <h1>¡Todo listo! 🎉</h1>
            <p>
              Tu Financial OS está configurado y procesando tus datos.
              <br />
              Ya podés ver la rentabilidad real de tu hotel.
            </p>
          </div>

          <div className={styles.completeHighlights}>
            <div className={styles.completeHighlight}>
              <TrendingUp size={24} />
              <span>Ganancia neta por reserva</span>
            </div>
            <div className={styles.completeHighlight}>
              <DollarSign size={24} />
              <span>Punto de equilibrio</span>
            </div>
            <div className={styles.completeHighlight}>
              <Sparkles size={24} />
              <span>Acciones para mejorar</span>
            </div>
          </div>

          <button 
            className={`${styles.btnPrimary} ${styles.btnPrimaryStandalone}`}
            onClick={handleComplete}
          >
            Ver mi Dashboard
            <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

