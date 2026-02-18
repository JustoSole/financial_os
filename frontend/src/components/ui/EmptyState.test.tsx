import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <BrowserRouter>
        <EmptyState title="Sin datos" description="Importá datos para continuar" />
      </BrowserRouter>
    );
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('Importá datos para continuar')).toBeInTheDocument();
  });

  it('renders internal CTA as Link when action.to is internal path', () => {
    render(
      <BrowserRouter>
        <EmptyState
          title="Sin datos"
          description="Importá datos"
          action={{ label: 'Ir a importar', to: '/importar' }}
        />
      </BrowserRouter>
    );
    const link = screen.getByRole('link', { name: /ir a importar/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/importar');
  });

  it('renders external CTA as button that opens in new tab when action.to is URL', () => {
    render(
      <BrowserRouter>
        <EmptyState
          title="Ayuda"
          description="Ver documentación"
          action={{ label: 'Abrir docs', to: 'https://example.com/docs' }}
        />
      </BrowserRouter>
    );
    const btn = screen.getByRole('button', { name: /abrir docs/i });
    expect(btn).toBeInTheDocument();
  });
});
