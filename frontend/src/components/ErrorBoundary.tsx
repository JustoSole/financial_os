import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', textAlign: 'center', padding: '2rem',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}>
          <div>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>
              Algo salio mal
            </h2>
            <p style={{ color: 'var(--color-text-secondary, #666)', marginBottom: '1.5rem' }}>
              Ocurrio un error inesperado. Intenta recargar la pagina.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.5rem', borderRadius: '8px',
                border: '1px solid var(--color-border, #ddd)',
                background: 'var(--color-primary, #2D3FE0)', color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem',
              }}
            >
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
