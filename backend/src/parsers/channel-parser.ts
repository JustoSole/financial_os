import { parseCSV, normalizeDecimal, findColumn } from './csv-parser';
import { ParsedChannel } from './types';

// =====================================================
// Channel Performance Summary Parser
// Columns from actual Cloudbeds export:
// - Reservation Source Category
// - Reservation Source
// - Room Nights - sum
// - Room Revenue Total - sum
// - Estimated Commission - sum
// =====================================================

export function parseChannelReport(content: string): {
  channels: ParsedChannel[];
  warnings: string[];
  errors: string[];
} {
  const result = parseCSV(content);
  const warnings: string[] = [];
  const errors: string[] = [];
  const channels: ParsedChannel[] = [];
  
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => e.message));
  }
  
  const headers = result.data.length > 0 ? Object.keys(result.data[0]) : [];
  
  // Find columns
  const sourceCategoryCol = findColumn(headers, 'source_category');
  const sourceCol = findColumn(headers, 'source');
  const roomNightsCol = findColumn(headers, 'room_nights');
  const roomRevenueCol = findColumn(headers, 'room_revenue_total');
  const estimatedCommissionCol = findColumn(headers, 'estimated_commission');
  
  // Validate required columns
  if (!sourceCol) {
    errors.push('No se encontró columna "Reservation Source" - requerida');
    return { channels, warnings, errors };
  }
  
  if (!roomRevenueCol) {
    warnings.push('No se encontró columna de ingresos - se usará 0');
  }
  
  for (const row of result.data) {
    try {
      const source = sourceCol ? row[sourceCol] : null;
      if (!source || source.trim() === '') continue;
      
      const roomNights = roomNightsCol ? Math.round(normalizeDecimal(row[roomNightsCol])) : 0;
      const roomRevenueTotal = roomRevenueCol ? normalizeDecimal(row[roomRevenueCol]) : 0;
      const estimatedCommission = estimatedCommissionCol ? normalizeDecimal(row[estimatedCommissionCol]) : 0;
      
      channels.push({
        sourceCategory: sourceCategoryCol ? row[sourceCategoryCol] || null : null,
        source: source.trim(),
        roomNights,
        roomRevenueTotal,
        estimatedCommission,
      });
    } catch (e) {
      warnings.push(`Error procesando fila: ${e}`);
    }
  }
  
  // Warn if no commission data
  const hasAnyCommission = channels.some(c => c.estimatedCommission > 0);
  if (!hasAnyCommission && channels.length > 0) {
    warnings.push('No se encontraron datos de comisión - se usarán tasas estimadas por defecto');
  }
  
  return { channels, warnings, errors };
}
