import React, { useState, useCallback } from 'react';
import { 
  X, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  FileText, 
  ShieldCheck,
  TrendingUp,
  History,
  Info,
  ChevronRight
} from 'lucide-react';
import styles from './OnboardingWizard.module.css';
import { validateFile, importFile, trackEvent } from '../api';
import { useApp } from '../context/AppContext';

interface OnboardingWizardProps {
  onComplete: () => void;
  onClose: () => void;
}

type StepStatus = 'pending' | 'validating' | 'importing' | 'success' | 'error';

interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  reportType: string;
  instructions: string[];
}

const STEPS: StepConfig[] = [
  {
    id: 'intro',
    title: 'Bienvenido a Financial OS',
    description: 'En solo 2 minutos vamos a conectar tus datos de Cloudbeds para darte visibilidad total de tu negocio.',
    icon: <ShieldCheck size={48} />,
    reportType: '',
    instructions: []
  },
  {
    id: 'transactions',
    title: 'Reporte de Transacciones',
    description: 'Este es el más importante. Incluye todos los cargos y pagos realizados.',
    icon: <FileText size={48} />,
    reportType: 'expanded_transactions',
    instructions: [
      'Andá a Reportes → Expanded Transaction Report with Details',
      'Seleccioná el período (recomendamos últimos 12 meses)',
      'Click en "Export" y elegí formato CSV',
      'Subilo aquí mismo'
    ]
  },
  {
    id: 'reservations',
    title: 'Reporte de Reservas',
    description: 'Para calcular tu rentabilidad real por cada reserva y canal.',
    icon: <TrendingUp size={48} />,
    reportType: 'reservations_financials',
    instructions: [
      'Andá a Reportes → Reservations with Financials',
      'Seleccioná el mismo período que el anterior',
      'Exportá como CSV',
      'Subilo aquí'
    ]
  },
  {
    id: 'channels',
    title: 'Performance de Canales',
    description: 'Opcional, pero vital para saber qué canal te deja más dinero.',
    icon: <History size={48} />,
    reportType: 'channel_performance',
    instructions: [
      'Andá a Reportes → Channel Performance Summary',
      'Seleccioná el mismo período',
      'Exportá como CSV',
      'Subilo aquí'
    ]
  }
];

export default function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const { property } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<StepStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const isIntro = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];
  const progress = showCelebration ? 100 : (currentStep / (STEPS.length - 1)) * 100;

  const handleNext = () => {
    if (isLastStep && status === 'success') {
      setShowCelebration(true);
    } else if (isIntro) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(prev => prev + 1);
      setStatus('pending');
      setError(null);
    }
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
    if (files.length > 0) handleFileSelection(files[0]);
  }, [currentStep]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFileSelection(e.target.files[0]);
  };

  const handleFileSelection = async (file: File) => {
    if (!property?.id) return;
    
    setStatus('validating');
    setError(null);

    try {
      const valResult = await validateFile(file);
      
      if (!valResult.success) {
        setStatus('error');
        setError(valResult.error || 'Archivo inválido. Asegurate de que sea el reporte correcto de Cloudbeds.');
        return;
      }

      if (valResult.data.reportType !== step.reportType) {
        setStatus('error');
        setError(`Este archivo parece ser de tipo "${valResult.data.reportType}". Por favor subí el "${step.reportType}".`);
        return;
      }

      setStatus('importing');
      const impResult = await importFile(property.id, file);

      if (impResult.success) {
        setStatus('success');
        trackEvent(property.id, 'onboarding_file_uploaded', { reportType: step.reportType });
      } else {
        setStatus('error');
        setError(impResult.error || 'Error al importar los datos.');
      }
    } catch (err) {
      setStatus('error');
      setError('Ocurrió un error inesperado.');
    }
  };

  return (
    <div className={styles.onboardingOverlay}>
      <div className={styles.onboardingCard}>
        <div className={styles.onboardingHeader}>
          <h2>Configuración guiada</h2>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
          <button className={styles.skipButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.onboardingContent}>
          <div className={styles.stepContainer}>
            {showCelebration ? (
              <div className={styles.celebration}>
                <div className={styles.iconWrapper} style={{ width: 100, height: 100, background: '#dcfce7', color: 'var(--color-success)' }}>
                  <CheckCircle size={60} />
                </div>
                <h2 className={styles.celebrationTitle}>¡Todo listo! 🎉</h2>
                <p className={styles.celebrationSubtitle}>
                  Tus datos han sido procesados. Ya podés acceder a tu Command Center con visibilidad total de tu hotel.
                </p>
                <button className={styles.nextButton} onClick={onComplete} style={{ margin: '0 auto' }}>
                  Ir a mi Dashboard
                  <ArrowRight size={20} />
                </button>
              </div>
            ) : !isIntro && status === 'success' ? (
              <div className={styles.successState}>
                <div className={styles.iconWrapper} style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>
                  <CheckCircle size={48} />
                </div>
                <h3 className={styles.stepTitle}>¡Excelente!</h3>
                <p className={styles.stepDescription}>
                  Hemos procesado el {step.title} correctamente.
                </p>
                <button className={styles.nextButton} onClick={handleNext}>
                  {isLastStep ? 'Finalizar' : 'Siguiente reporte'}
                  <ChevronRight size={20} />
                </button>
              </div>
            ) : status === 'validating' || status === 'importing' ? (
              <div className={status === 'validating' ? styles.validatingState : styles.importingState}>
                <Loader2 size={48} className={styles.spinner} />
                <h3 className={styles.stepTitle}>
                  {status === 'validating' ? 'Validando...' : 'Importando...'}
                </h3>
                <p className={styles.stepDescription}>
                  Estamos procesando tus datos de Cloudbeds. Esto solo toma unos segundos.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.iconWrapper}>
                  {step.icon}
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>

                {isIntro ? (
                  <button className={styles.nextButton} onClick={handleNext}>
                    Empezar ahora
                    <ArrowRight size={20} />
                  </button>
                ) : (
                  <>
                    <div 
                      className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileInput} 
                        className={styles.uploadInput} 
                      />
                      <Upload className={styles.uploadIcon} size={32} />
                      <div className={styles.uploadText}>Arrastrá el CSV o hacé click aquí</div>
                      <div className={styles.uploadSubtext}>Solo archivos .csv exportados de Cloudbeds</div>
                    </div>

                    {error && (
                      <div className={styles.errorState}>
                        <AlertCircle size={16} /> {error}
                      </div>
                    )}

                    <div className={styles.stepGuide}>
                      <h4><Info size={16} /> Paso a paso:</h4>
                      <ol>
                        {step.instructions.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ol>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {!showCelebration && (
          <div className={styles.onboardingFooter}>
            <div className={styles.footerStepInfo}>
              Paso {currentStep + 1} de {STEPS.length}
            </div>
            {currentStep > 0 && status !== 'success' && (
              <button className={styles.skipButton} onClick={handleNext}>
                {step.reportType === 'expanded_transactions' ? 'No puedo ahora' : 'Saltar este paso'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

