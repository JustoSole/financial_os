import styles from './Loading.module.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const spinnerClasses = [
    styles.spinner,
    styles[size],
    className
  ].filter(Boolean).join(' ');
  return <div className={spinnerClasses} />;
}

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Cargando...', className = '' }: LoadingStateProps) {
  const containerClasses = [
    styles.loadingState,
    className
  ].filter(Boolean).join(' ');
  return (
    <div className={containerClasses}>
      <div className={styles.pulse} />
      <p>{message}</p>
    </div>
  );
}

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius,
  className = '' 
}: SkeletonProps) {
  const skeletonClasses = [
    styles.skeleton,
    className
  ].filter(Boolean).join(' ');
  return (
    <div 
      className={skeletonClasses}
      style={{ 
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
    />
  );
}


