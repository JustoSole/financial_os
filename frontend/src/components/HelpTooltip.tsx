import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { getTerm, GlossaryTerm } from '../utils/glossary';
import styles from './HelpTooltip.module.css';

interface HelpTooltipProps {
  /** Clave del término en el glosario */
  termKey?: string;
  /** O pasar el contenido directamente */
  title?: string;
  content?: string;
  /** Tamaño del ícono */
  size?: 'sm' | 'md' | 'lg';
  /** Posición preferida */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Clase adicional */
  className?: string;
}

export function HelpTooltip({
  termKey,
  title,
  content,
  size = 'sm',
  position = 'top',
  className = '',
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  let term: GlossaryTerm | undefined;
  if (termKey) {
    term = getTerm(termKey);
  }

  const displayTitle = title || term?.term || '';
  const displayContent = content || term?.shortExplanation || '';

  useEffect(() => {
    if (isOpen && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      let newPosition = position;

      if (position === 'top' && rect.top < 0) newPosition = 'bottom';
      else if (position === 'bottom' && rect.bottom > window.innerHeight) newPosition = 'top';
      else if (position === 'left' && rect.left < 0) newPosition = 'right';
      else if (position === 'right' && rect.right > window.innerWidth) newPosition = 'left';

      setActualPosition(newPosition);
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const iconSizes = { sm: 14, md: 16, lg: 18 };

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
          {displayTitle && <div className={styles.title}>{displayTitle}</div>}
          <div className={styles.content}>{displayContent}</div>
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
