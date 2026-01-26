import { parseCSV, normalizeDecimal, normalizeDateTime, findColumn, generateRowHash } from './csv-parser';
import { ParsedTransaction } from './types';

// =====================================================
// Expanded Transaction Report with Details Parser
// Columns from actual Cloudbeds export:
// - Transaction Date Time - Property
// - Reservation Number, Reservation Source
// - Transaction Type, Void Flag, Refund Flag, Adjustment Flag
// - Debits, Credits, Transaction Amount
// - Transaction Description, Transaction Notes, Transaction Source
// =====================================================

export function parseTransactionReport(content: string): {
  transactions: ParsedTransaction[];
  warnings: string[];
  errors: string[];
} {
  const result = parseCSV(content);
  const warnings: string[] = [];
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => e.message));
  }
  
  const headers = result.data.length > 0 ? Object.keys(result.data[0]) : [];
  
  // Find required columns (using Cloudbeds exact names)
  const txnDateCol = findColumn(headers, 'txn_datetime');
  const reservationNumCol = findColumn(headers, 'reservation_number');
  const reservationSourceCol = findColumn(headers, 'reservation_source');
  const txnTypeCol = findColumn(headers, 'transaction_type');
  const voidFlagCol = findColumn(headers, 'void_flag');
  const refundFlagCol = findColumn(headers, 'refund_flag');
  const adjustmentFlagCol = findColumn(headers, 'adjustment_flag');
  const debitsCol = findColumn(headers, 'debits');
  const creditsCol = findColumn(headers, 'credits');
  const descriptionCol = findColumn(headers, 'transaction_description');
  const notesCol = findColumn(headers, 'transaction_notes');
  const txnSourceCol = findColumn(headers, 'transaction_source');
  
  // Validate required columns
  if (!txnDateCol) {
    errors.push('No se encontró columna "Transaction Date Time - Property" - requerida');
  }
  if (!debitsCol && !creditsCol) {
    errors.push('No se encontró columna "Debits" ni "Credits" - al menos una es requerida');
  }
  
  if (errors.length > 0) {
    return { transactions, warnings, errors };
  }
  
  let skippedVoid = 0;
  let skippedZero = 0;
  
  for (const row of result.data) {
    try {
      // Check void flag - skip void transactions
      const isVoid = voidFlagCol ? parseBooleanFlag(row[voidFlagCol]) : false;
      if (isVoid) {
        skippedVoid++;
        continue;
      }
      
      // Parse amounts
      const debits = debitsCol ? normalizeDecimal(row[debitsCol]) : 0;
      const credits = creditsCol ? normalizeDecimal(row[creditsCol]) : 0;
      
      // Skip zero-amount transactions
      if (debits === 0 && credits === 0) {
        skippedZero++;
        continue;
      }
      
      // Parse date
      const txnAt = txnDateCol ? normalizeDateTime(row[txnDateCol]) : null;
      if (!txnAt) {
        warnings.push(`Fila ignorada: fecha inválida "${row[txnDateCol!]}"`);
        continue;
      }
      
      // Parse flags
      const isRefund = refundFlagCol ? parseBooleanFlag(row[refundFlagCol]) : false;
      const isAdjustment = adjustmentFlagCol ? parseBooleanFlag(row[adjustmentFlagCol]) : false;
      
      // Extract reservation number from URL if needed
      const reservationNumber = reservationNumCol 
        ? extractReservationNumber(row[reservationNumCol]) 
        : null;
      
      transactions.push({
        txnAt,
        reservationNumber,
        reservationSource: reservationSourceCol ? row[reservationSourceCol] || null : null,
        txnType: txnTypeCol ? row[txnTypeCol] || null : null,
        debits,
        credits,
        voidFlag: false, // Already filtered out
        refundFlag: isRefund,
        adjustmentFlag: isAdjustment,
        description: descriptionCol ? row[descriptionCol] || null : null,
        notes: notesCol ? row[notesCol] || null : null,
        txnSource: txnSourceCol ? row[txnSourceCol] || null : null,
        // Natural key for UPSERT (Issue B)
        rowHash: generateRowHash(row)
      });
    } catch (e) {
      warnings.push(`Error procesando fila: ${e}`);
    }
  }
  
  if (skippedVoid > 0) {
    warnings.push(`Se ignoraron ${skippedVoid} transacciones anuladas (Void)`);
  }
  if (skippedZero > 0) {
    warnings.push(`Se ignoraron ${skippedZero} transacciones con monto cero`);
  }
  
  return { transactions, warnings, errors };
}

/**
 * Parse Yes/No or True/False boolean flags
 */
function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === 'sí' || lower === 'si' || lower === '1';
}

/**
 * Extract reservation number from Cloudbeds URL or plain text
 * Example: "https://us1.cloudbeds.com/connect/22593#/reservations/155379280?display=..."
 * Should extract: "155379280"
 */
function extractReservationNumber(value: string | undefined): string | null {
  if (!value) return null;
  
  // Check if it's a URL
  if (value.includes('cloudbeds.com') && value.includes('/reservations/')) {
    const match = value.match(/\/reservations\/(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Otherwise return as-is if it looks like a number
  const cleaned = value.trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned;
  }
  
  return cleaned || null;
}
