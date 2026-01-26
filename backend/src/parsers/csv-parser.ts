import Papa from 'papaparse';
import { ValidationResult } from './types';
import { ReportType } from '../types';

// =====================================================
// CSV Parser with Auto-Detection for Cloudbeds Reports
// =====================================================

interface ParseOptions {
  encoding?: string;
}

export function parseCSV(content: string, options: ParseOptions = {}): Papa.ParseResult<Record<string, string>> {
  // Cloudbeds CSVs often have a BOM or weird encoding. 
  // Let's ensure we have a clean string.
  const cleanContent = content.replace(/^\uFEFF/, '').trim();
  
  const lines = cleanContent.split(/\r?\n/);
  const firstLine = lines[0] || '';
  
  // Cloudbeds uses semicolon in many regions, comma in others.
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  console.log(`[CSV-PARSER] Parsing. Delimiter: "${delimiter}", Headers: ${firstLine.substring(0, 100)}...`);

  return Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (header) => {
      // Cloudbeds headers can have spaces, special chars, and case differences.
      // We normalize to lowercase and remove non-alphanumeric for matching.
      return header.trim().toLowerCase();
    },
    transform: (value) => value.trim(),
  });
}

// Normalize decimal format (European 1.234,56 → 1234.56)
export function normalizeDecimal(value: string): number {
  if (!value || value === '-' || value === '') return 0;
  
  // Remove currency symbols and spaces
  let cleaned = value.replace(/[$€£¥₱\s]/g, '');
  
  // Detect format: if has both . and , check which is decimal separator
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  
  if (lastComma > lastDot) {
    // European format: 1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,234.56
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma > -1 && lastDot === -1) {
    // Only comma: could be European decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse date in various formats → ISO date string (YYYY-MM-DD)
export function normalizeDate(value: string): string | null {
  if (!value) return null;
  
  const cleaned = value.trim();
  
  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }
  
  // MM/DD/YYYY or DD/MM/YYYY - assume US format as Cloudbeds default
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    // Assume US format (MM/DD/YYYY)
    const month = first.padStart(2, '0');
    const day = second.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Try JS Date parsing as fallback
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().substring(0, 10);
  }
  
  return null;
}

// Parse datetime → ISO datetime string (YYYY-MM-DD HH:mm:ss)
export function normalizeDateTime(value: string): string | null {
  if (!value) return null;
  
  const cleaned = value.trim();
  
  // Already ISO format: 2024-01-15 14:30:00
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(cleaned)) {
    return cleaned;
  }
  
  // ISO format with T: 2024-01-15T14:30:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleaned)) {
    return cleaned.replace('T', ' ').substring(0, 19);
  }
  
  // Just date, add midnight
  const dateOnly = normalizeDate(cleaned);
  if (dateOnly) {
    return `${dateOnly} 00:00:00`;
  }
  
  // Try JS Date parsing
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
  
  return null;
}

// =====================================================
// Column Mapping - Cloudbeds Report Columns
// =====================================================

const COLUMN_MAPPINGS: Record<string, string[]> = {
  // === Expanded Transaction Report with Details ===
  'txn_datetime': [
    'transaction date time - property', 
    'transaction date time', 
    'fecha de transacción',
    'transaction date'
  ],
  'reservation_number': [
    'reservation number', 
    'número de reserva', 
    'reserva'
  ],
  'reservation_source': [
    'reservation source', 
    'fuente de reserva',
    'source'
  ],
  'transaction_type': [
    'transaction type', 
    'tipo de transacción'
  ],
  'void_flag': [
    'void flag', 
    'anulado'
  ],
  'refund_flag': [
    'refund flag', 
    'reembolso'
  ],
  'adjustment_flag': [
    'adjustment flag', 
    'ajuste'
  ],
  'debits': [
    'debits', 
    'débitos', 
    'cargos'
  ],
  'credits': [
    'credits', 
    'créditos', 
    'abonos'
  ],
  'transaction_description': [
    'transaction description', 
    'descripción de transacción'
  ],
  'transaction_notes': [
    'transaction notes', 
    'notas de transacción'
  ],
  'transaction_source': [
    'transaction source', 
    'fuente de transacción'
  ],
  
  // === Reservations with Financials ===
  'primary_guest_full_name': [
    'primary guest full name',
    'guest name',
    'nombre del huésped',
    'huésped',
  ],
  'reservation_status': [
    'reservation status', 
    'estado de reserva'
  ],
  'reservation_source_category': [
    'reservation source category', 
    'categoría de fuente'
  ],
  'check_in_date': [
    'check-in date', 
    'check in date',
    'fecha de check-in',
    'check in'
  ],
  'check_out_date': [
    'check-out date', 
    'check out date',
    'fecha de check-out',
    'check out'
  ],
  'room_nights': [
    'room nights', 
    'room nights - sum',
    'noches'
  ],
  'room_revenue_total': [
    'room revenue total', 
    'room revenue total - sum',
    'ingresos por habitación'
  ],
  'total_reservation_taxes': [
    'total reservation taxes', 
    'total reservation taxes - sum',
    'impuestos'
  ],
  'reservation_paid_amount': [
    'reservation paid amount', 
    'monto pagado'
  ],
  'reservation_balance_due': [
    'reservation balance due', 
    'saldo pendiente'
  ],
  'suggested_deposit': [
    'suggested deposit', 
    'depósito sugerido'
  ],
  'hotel_collect_booking_flag': [
    'hotel collect booking flag', 
    'cobro del hotel'
  ],
  'estimated_commission': [
    'estimated commission',
    'estimated commission - sum',
    'comisión estimada'
  ],
  'grand_total': [
    'grand total',
    'grand total - sum',
    'total general'
  ],
  
  // === Channel Performance Summary ===
  'source_category': [
    'reservation source category',
    'source category',
    'categoría de fuente'
  ],
  'source': [
    'reservation source',
    'source',
    'fuente',
    'canal'
  ],
  'room_count': [
    'room count',
    'room count - sum',
    'habitaciones'
  ],
};

export function findColumn(headers: string[], targetField: string): string | null {
  const possibleNames = COLUMN_MAPPINGS[targetField] || [targetField];
  
  // First pass: exact match (preferred)
  for (const name of possibleNames) {
    const found = headers.find(h => h.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  
  // Second pass: includes match (fallback, but be careful)
  for (const name of possibleNames) {
    const found = headers.find(h => h.toLowerCase().includes(name.toLowerCase()));
    if (found) return found;
  }
  
  return null;
}

// =====================================================
// Report Type Detection
// =====================================================

export function detectReportType(headers: string[]): ReportType | 'unknown' {
  const h = headers.map(h => h.toLowerCase());
  
  // Expanded Transaction Report
  if (h.includes('debits') || h.includes('credits') || h.includes('transaction type')) {
    return 'expanded_transactions';
  }
  
  // Reservations with Financials
  if (h.includes('reservation number') && (h.includes('check-in date') || h.includes('room nights'))) {
    return 'reservations_financials';
  }
  
  // Channel Performance
  if (h.includes('reservation source') && h.includes('room revenue total - sum')) {
    return 'channel_performance';
  }

  return 'unknown';
}

// =====================================================
// Currency Detection
// =====================================================

export type DetectedCurrency = 'ARS' | 'USD' | 'MXN' | 'COP' | 'BRL' | 'EUR' | 'unknown';

/**
 * Detecta la moneda basándose en la magnitud de los valores monetarios.
 * Heurística: 
 * - ADR (Average Daily Rate) típico en USD: $50-$500
 * - ADR típico en ARS: $50,000-$500,000
 * - ADR típico en MXN: $500-$5,000
 * - ADR típico en COP: $100,000-$1,000,000
 * - ADR típico en BRL: $200-$2,000
 * 
 * Usamos el ADR promedio para determinar la moneda.
 */
export function detectCurrency(data: Record<string, string>[], reportType: ReportType): DetectedCurrency {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Recopilar valores de revenue y noches para calcular ADR
  let totalRevenue = 0;
  let totalNights = 0;
  let sampleCount = 0;
  const maxSamples = 50; // Analizar máximo 50 filas para eficiencia
  
  // También recopilar valores de transacciones individuales
  const transactionValues: number[] = [];
  
  if (reportType === 'reservations_financials' || reportType === 'channel_performance') {
    const revenueCol = findColumn(headers, 'room_revenue_total');
    const nightsCol = findColumn(headers, 'room_nights');
    
    for (const row of data.slice(0, maxSamples)) {
      const revenue = revenueCol ? normalizeDecimal(row[revenueCol]) : 0;
      const nights = nightsCol ? normalizeDecimal(row[nightsCol]) : 0;
      
      if (revenue > 0 && nights > 0) {
        totalRevenue += revenue;
        totalNights += nights;
        sampleCount++;
      }
    }
  } else if (reportType === 'expanded_transactions') {
    const debitsCol = findColumn(headers, 'debits');
    const creditsCol = findColumn(headers, 'credits');
    
    for (const row of data.slice(0, maxSamples)) {
      const debits = debitsCol ? normalizeDecimal(row[debitsCol]) : 0;
      const credits = creditsCol ? normalizeDecimal(row[creditsCol]) : 0;
      
      // Tomar valores mayores a 0 que parezcan room rates (no pagos muy altos ni muy bajos)
      if (debits > 0) transactionValues.push(debits);
      if (credits > 0) transactionValues.push(credits);
    }
  }
  
  // Calcular ADR o valor promedio de transacción
  let avgValue = 0;
  
  if (totalNights > 0) {
    avgValue = totalRevenue / totalNights;
  } else if (transactionValues.length > 0) {
    // Filtrar outliers (pagos muy grandes que pueden ser totales de reserva)
    const sortedValues = transactionValues.sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedValues.length / 2);
    avgValue = sortedValues[medianIndex];
  }
  
  if (avgValue === 0) {
    return 'unknown';
  }
  
  // Heurísticas de detección basadas en rangos típicos de ADR
  // Los rangos se superponen un poco para dar margen
  
  if (avgValue >= 30000 && avgValue <= 1000000) {
    // Rango típico de ARS (pesos argentinos) - ADR $50K-$300K
    return 'ARS';
  }
  
  if (avgValue >= 50000 && avgValue <= 2000000) {
    // Rango típico de COP (pesos colombianos) - ADR $100K-$500K
    // Difícil distinguir de ARS, pero COP suele ser más alto
    if (avgValue > 500000) {
      return 'COP';
    }
    return 'ARS'; // Default a ARS si está en rango ambiguo
  }
  
  if (avgValue >= 200 && avgValue <= 3000) {
    // Rango típico de MXN (pesos mexicanos) - ADR $500-$3000
    return 'MXN';
  }
  
  if (avgValue >= 100 && avgValue <= 5000) {
    // Rango típico de BRL (reales brasileños) - ADR $200-$2000
    // Difícil distinguir de MXN
    if (avgValue < 200) {
      return 'BRL';
    }
    // En rango ambiguo MXN/BRL, asumimos MXN
    return 'MXN';
  }
  
  if (avgValue >= 20 && avgValue <= 800) {
    // Rango típico de USD o EUR - ADR $50-$500
    return 'USD';
  }
  
  if (avgValue >= 15 && avgValue <= 600) {
    // EUR tiene rango similar a USD
    return 'EUR';
  }
  
  // Si no encaja en ningún rango conocido, intentar inferir por magnitud
  if (avgValue > 10000) {
    // Moneda "débil" - probablemente ARS o COP
    return 'ARS';
  }
  
  if (avgValue > 100) {
    // Probablemente MXN o BRL
    return 'MXN';
  }
  
  // Default a USD para valores bajos
  return 'USD';
}

/**
 * Genera un hash simple para el contenido de una fila para detectar duplicados
 */
export function generateRowHash(row: Record<string, string>): string {
  const str = JSON.stringify(row);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Obtiene el símbolo de moneda para display
 */
export function getCurrencySymbol(currency: DetectedCurrency): string {
  const symbols: Record<DetectedCurrency, string> = {
    'ARS': 'ARS $',
    'USD': 'US$',
    'MXN': 'MX$',
    'COP': 'COP $',
    'BRL': 'R$',
    'EUR': '€',
    'unknown': '$',
  };
  return symbols[currency];
}

// =====================================================
// Validation
// =====================================================

export function validateReport(
  data: Record<string, string>[],
  reportType: ReportType | 'unknown'
): ValidationResult {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    return {
      isValid: false,
      reportType,
      detectedColumns: headers,
      missingRequired: ['El archivo está vacío'],
      warnings: [],
      preview: []
    };
  }

  if (reportType === 'unknown') {
    return {
      isValid: false,
      reportType,
      detectedColumns: headers,
      missingRequired: ['No se pudo detectar el tipo de reporte de Cloudbeds'],
      warnings: [],
      preview: data.slice(0, 5)
    };
  }

  // Validaciones específicas por tipo
  if (reportType === 'expanded_transactions') {
    if (!findColumn(headers, 'debits') && !findColumn(headers, 'credits')) {
      missingRequired.push('Faltan columnas de montos (Debits/Credits)');
    }
    if (!findColumn(headers, 'txn_datetime')) {
      missingRequired.push('Falta columna de fecha de transacción');
    }
  } else if (reportType === 'reservations_financials') {
    if (!findColumn(headers, 'reservation_number')) {
      missingRequired.push('Falta columna de número de reserva');
    }
    if (!findColumn(headers, 'check_in_date')) {
      missingRequired.push('Falta columna de fecha de check-in');
    }
    if (!findColumn(headers, 'room_revenue_total')) {
      missingRequired.push('Falta columna de ingresos por habitación');
    }
  }

  // Validación de integridad de datos (ej. valores negativos inesperados o fechas inválidas)
  const sample = data.slice(0, 20);
  let invalidDataCount = 0;
  
  if (reportType === 'reservations_financials') {
    const revenueCol = findColumn(headers, 'room_revenue_total');
    sample.forEach(row => {
      const val = revenueCol ? normalizeDecimal(row[revenueCol]) : 0;
      if (isNaN(val)) invalidDataCount++;
    });
  }

  if (invalidDataCount > sample.length * 0.5) {
    warnings.push('Se detectaron muchos valores numéricos inválidos. Verificá el formato del CSV.');
  }

  return {
    isValid: missingRequired.length === 0,
    reportType,
    detectedColumns: headers,
    missingRequired,
    warnings,
    preview: data.slice(0, 5)
  };
}
