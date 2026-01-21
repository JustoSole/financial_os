import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Lightbulb } from 'lucide-react';
import { getTerm, GlossaryTerm } from '../utils/glossary';
import styles from './HelpTooltip.module.css';

interface HelpTooltipProps {
  /** Clave del término en el glosario */
  termKey?: string;
  /** O pasar el contenido directamente */
  title?: string;
  content?: string;
  example?: string;
  /** Tamaño del ícono */
  size?: 'sm' | 'md' | 'lg';
  /** Posición preferida */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Mostrar siempre visible (no en hover) */
  persistent?: boolean;
  /** Clase adicional */
  className?: string;
}

export function HelpTooltip({
  termKey,
  title,
  content,
  example,
  size = 'sm',
  position = 'top',
  persistent = false,
  className = '',
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Obtener datos del glosario si se pasa termKey
  let term: GlossaryTerm | undefined;
  if (termKey) {
    term = getTerm(termKey);
  }

  const displayTitle = title || term?.term || '';
  const displayContent = content || term?.fullExplanation || '';
  const displayExample = example || term?.example;

  // Ajustar posición si el tooltip se sale de la pantalla
  useEffect(() => {
    if (isOpen && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let newPosition = position;

      if (position === 'top' && rect.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && rect.bottom > windowHeight) {
        newPosition = 'top';
      } else if (position === 'left' && rect.left < 0) {
        newPosition = 'right';
      } else if (position === 'right' && rect.right > windowWidth) {
        newPosition = 'left';
      }

      setActualPosition(newPosition);
    }
  }, [isOpen, position]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  if (!displayContent) return null;

  const positionClasses: Record<string, string> = {
    top: styles.posTop,
    bottom: styles.posBottom,
    left: styles.posLeft,
    right: styles.posRight,
  };

  return (
    <span className={`${styles.wrapper} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${styles[size]}`}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => !persistent && setIsOpen(true)}
        onMouseLeave={() => !persistent && setIsOpen(false)}
        aria-label={`Ayuda: ${displayTitle}`}
      >
        <HelpCircle size={iconSizes[size]} />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`${styles.tooltip} ${positionClasses[actualPosition]}`}
          role="tooltip"
        >
          {persistent && (
            <button
              className={styles.close}
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          )}

          {displayTitle && <div className={styles.title}>{displayTitle}</div>}

          <div className={styles.content}>{displayContent}</div>

          {displayExample && (
            <div className={styles.example}>
              <Lightbulb size={12} />
              <span>{displayExample}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * Componente inline para explicar términos dentro del texto
 */
interface InlineHelpProps {
  termKey: string;
  children: React.ReactNode;
}

export function InlineHelp({ termKey, children }: InlineHelpProps) {
  const term = getTerm(termKey);
  
  if (!term) return <>{children}</>;

  return (
    <span className={styles.inlineHelp}>
      {children}
      <HelpTooltip termKey={termKey} size="sm" />
    </span>
  );
}

export default HelpTooltip;
