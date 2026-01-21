import { nanoid } from 'nanoid';
import database from '../db';
import cacheService from './cache-service';
import { ReportType } from '../types';
import {
  parseCSV,
  detectReportType,
  validateReport,
  parseTransactionReport,
  parseReservationsReport,
  parseChannelReport,
  detectCurrency,
  DetectedCurrency,
} from '../parsers';

// =====================================================
// Import Service - Handles CSV uploads for MVS
// Supports 3 report types:
// 1. Expanded Transaction Report with Details
// 2. Reservations with Financials
// 3. Channel Performance Summary
// =====================================================

const PARSER_VERSION = '1.1.0';

export interface ImportResult {
  success: boolean;
  fileId: string;
  reportType: ReportType | 'unknown';
  rowsProcessed: number;
  rowsSkipped: number;
  warnings: string[];
  errors: string[];
  detectedCurrency?: DetectedCurrency;
}

export async function importCSV(
  propertyId: string,
  filename: string,
  content: string
): Promise<ImportResult> {
  const fileId = nanoid();
  const result: ImportResult = {
    success: false,
    fileId,
    reportType: 'unknown',
    rowsProcessed: 0,
    rowsSkipped: 0,
    warnings: [],
    errors: [],
  };

  try {
    // Parse and detect type
    const parsed = parseCSV(content);
    if (parsed.errors.length > 0) {
      result.errors.push(...parsed.errors.map(e => e.message));
      return result;
    }

    const headers = parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [];
    const reportType = detectReportType(headers);
    result.reportType = reportType;

    if (reportType === 'unknown') {
      result.errors.push(
        'No se pudo identificar el tipo de reporte. ' +
        'Verificá que sea uno de estos reportes de Cloudbeds:\n' +
        '• Expanded Transaction Report with Details\n' +
        '• Reservations with Financials\n' +
        '• Channel Performance Summary'
      );
      return result;
    }

    // Detect currency from the data
    const detectedCurrency = detectCurrency(parsed.data, reportType);
    result.detectedCurrency = detectedCurrency;
    
    // Update property currency if detected and different from current
    if (detectedCurrency !== 'unknown') {
      const property = database.getProperty();
      if (property && property.currency !== detectedCurrency) {
        database.updateProperty(propertyId, {
          currency: detectedCurrency,
          updated_at: new Date().toISOString(),
        });
        result.warnings.push(`Moneda detectada automáticamente: ${detectedCurrency}`);
      }
    }

    // Create import file record
    database.insertImportFile({
      id: fileId,
      property_id: propertyId,
      report_type: reportType,
      filename,
      uploaded_at: new Date().toISOString(),
      rows: parsed.data.length,
      warnings_count: 0,
      status: 'processing',
      parser_version: PARSER_VERSION,
    });

    // Process based on type
    switch (reportType) {
      case 'expanded_transactions':
        await processTransactions(propertyId, fileId, content, result);
        break;
      case 'reservations_financials':
        await processReservations(propertyId, fileId, content, result);
        break;
      case 'channel_performance':
        await processChannels(propertyId, fileId, content, result);
        break;
      default:
        result.errors.push(`Tipo de reporte no soportado: ${reportType}`);
    }

    // Update file status
    const status = result.errors.length === 0 ? 'processed' : 'failed';
    database.updateImportFile(fileId, {
      status,
      warnings_count: result.warnings.length,
      error_message: result.errors.join('; ') || null,
    });

    result.success = result.errors.length === 0;

    // Log import
    logImport(propertyId, result.success ? 'import_success' : 'import_failed', {
      fileId,
      reportType,
      rowsProcessed: result.rowsProcessed,
      errors: result.errors,
    });

    // Clear cache after successful import
    if (result.success) {
      cacheService.clear();
    }

  } catch (error: any) {
    result.errors.push(`Error interno: ${error.message}`);
    logImport(propertyId, 'import_failed', { error: error.message });
  }

  return result;
}

// =====================================================
// Process Expanded Transaction Report with Details
// =====================================================
async function processTransactions(
  propertyId: string,
  fileId: string,
  content: string,
  result: ImportResult
) {
  const { transactions, warnings, errors } = parseTransactionReport(content);
  result.warnings.push(...warnings);
  result.errors.push(...errors);

  if (errors.length > 0) return;

  const records = transactions.map(txn => ({
    id: nanoid(),
    property_id: propertyId,
    txn_at: txn.txnAt,
    reservation_number: txn.reservationNumber,
    reservation_source: txn.reservationSource,
    txn_type: txn.txnType,
    debits: txn.debits,
    credits: txn.credits,
    void_flag: txn.voidFlag,
    refund_flag: txn.refundFlag,
    adjustment_flag: txn.adjustmentFlag,
    description: txn.description,
    notes: txn.notes,
    txn_source: txn.txnSource,
    source_file_id: fileId,
    created_at: new Date().toISOString(),
  }));

  database.insertTransactions(records);
  result.rowsProcessed = transactions.length;
  result.rowsSkipped = 0;
}

// =====================================================
// Process Reservations with Financials
// =====================================================
async function processReservations(
  propertyId: string,
  fileId: string,
  content: string,
  result: ImportResult
) {
  const { reservations, warnings, errors } = parseReservationsReport(content);
  result.warnings.push(...warnings);
  result.errors.push(...errors);

  if (errors.length > 0) return;

  const records = reservations.map(res => ({
    id: nanoid(),
    property_id: propertyId,
    reservation_number: res.reservationNumber,
    guest_name: res.guestName,
    status: res.status,
    source_category: res.sourceCategory,
    source: res.source,
    check_in: res.checkIn,
    check_out: res.checkOut,
    room_nights: res.roomNights,
    room_revenue_total: res.roomRevenueTotal,
    taxes_total: res.taxesTotal,
    paid_amount: res.paidAmount,
    balance_due: res.balanceDue,
    suggested_deposit: res.suggestedDeposit,
    hotel_collect_flag: res.hotelCollectFlag,
    source_file_id: fileId,
    created_at: new Date().toISOString(),
  }));

  database.insertReservations(records);
  result.rowsProcessed = reservations.length;
}

// =====================================================
// Process Channel Performance Summary
// =====================================================
async function processChannels(
  propertyId: string,
  fileId: string,
  content: string,
  result: ImportResult
) {
  const { channels, warnings, errors } = parseChannelReport(content);
  result.warnings.push(...warnings);
  result.errors.push(...errors);

  if (errors.length > 0) return;

  const records = channels.map(ch => ({
    id: nanoid(),
    property_id: propertyId,
    source_category: ch.sourceCategory,
    source: ch.source,
    room_nights: ch.roomNights,
    room_revenue_total: ch.roomRevenueTotal,
    estimated_commission: ch.estimatedCommission,
    source_file_id: fileId,
    created_at: new Date().toISOString(),
  }));

  database.insertChannels(records);
  result.rowsProcessed = channels.length;
}

// =====================================================
// Logging
// =====================================================
function logImport(propertyId: string, eventType: string, data: any) {
  database.insertLog({
    id: nanoid(),
    property_id: propertyId,
    event_type: eventType,
    event_data: JSON.stringify(data),
    created_at: new Date().toISOString(),
  });
}

// =====================================================
// Validate without importing
// =====================================================
export function validateCSV(content: string): {
  reportType: ReportType | 'unknown';
  isValid: boolean;
  detectedColumns: string[];
  missingRequired: string[];
  warnings: string[];
  preview: Record<string, any>[];
} {
  const parsed = parseCSV(content);
  const headers = parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [];
  const reportType = detectReportType(headers);

  if (reportType === 'unknown') {
    return {
      reportType: 'unknown',
      isValid: false,
      detectedColumns: headers,
      missingRequired: [],
      warnings: [
        'No se reconoce el formato del reporte. ' +
        'Asegurate de exportar como "Table" o "Details Only" en formato CSV.'
      ],
      preview: parsed.data.slice(0, 5),
    };
  }

  return validateReport(parsed.data, reportType);
}
