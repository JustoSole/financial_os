import { describe, it, expect } from 'vitest';
import { getCompletarDatosDestination } from './ConfidenceHeader';

describe('getCompletarDatosDestination', () => {
  it('returns /costos when only costos-related issues (no import keyword)', () => {
    expect(getCompletarDatosDestination(['Configurar costos fijos'])).toBe('/costos');
    expect(getCompletarDatosDestination(['Costos sin configurar'])).toBe('/costos');
  });

  it('returns /importar when import-related issues', () => {
    expect(getCompletarDatosDestination(['Falta importar reporte'])).toBe('/importar');
    expect(getCompletarDatosDestination(['Importar transactions'])).toBe('/importar');
  });

  it('returns /importar when both costos and import issues (import takes precedence)', () => {
    expect(getCompletarDatosDestination(['Costos sin configurar', 'Falta importar'])).toBe('/importar');
  });

  it('returns /importar for empty or unknown issues', () => {
    expect(getCompletarDatosDestination([])).toBe('/importar');
    expect(getCompletarDatosDestination(['Otro problema'])).toBe('/importar');
  });
});
