import { 
  ReportType, 
} from '../types';
import database from '../db';
import { 
  parseCSV, 
  detectReportType, 
  validateReport, 
  parseTransactions, 
  parseReservations,
  detectCurrency
} from '../parsers';
import { cacheService } from './cache-service';
import logger from './logger';

/**
 * Import Service - Handles CSV parsing and data ingestion
 * Centralized orchestration for all Cloudbeds reports.
 */
export async function importCSV(propertyId: string, filename: string, content: string): Promise<any> {
  logger.info('IMPORT', `Starting import for file: ${filename}`, { propertyId });
  
  try {
    // 1. Limpieza y Parseo inicial
    const parseResult = parseCSV(content);
    logger.debug('IMPORT', `CSV Parsed. Rows found: ${parseResult.data.length}. Delimiter: ${parseResult.meta.delimiter}`);
    
    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      logger.error('IMPORT', 'Parse errors detected', parseResult.errors);
      return { success: false, error: 'Error al leer el archivo CSV. Verificá que el formato sea correcto.', details: parseResult.errors };
    }

    const headers = Object.keys(parseResult.data[0] || {});
    
    // 2. Detección de Tipo de Reporte y Moneda
    const reportType = detectReportType(headers);
    const detectedCurrency = detectCurrency(parseResult.data, reportType as ReportType);
    
    logger.info('IMPORT', `Detected: Type=${reportType}, Currency=${detectedCurrency}`);

    if (reportType === 'unknown') {
      logger.error('IMPORT', 'Unknown report type', { headers });
      return { 
        success: false, 
        error: 'No se pudo identificar el reporte. Asegurate de usar los reportes originales de Cloudbeds.', 
        details: { headers } 
      };
    }

    // 3. Validación de Columnas
    const validation = validateReport(parseResult.data, reportType);
    if (!validation.isValid) {
      logger.error('IMPORT', 'Validation failed', validation.missingRequired);
      return { 
        success: false, 
        error: `Al reporte le faltan columnas obligatorias: ${validation.missingRequired.join(', ')}`,
        details: validation
      };
    }

    // 4. Registrar inicio en DB
    const importFile = await database.insertImportFile({
      propertyId,
      reportType,
      filename,
      rows: parseResult.data.length,
      warningsCount: validation.warnings.length,
      status: 'processing',
      parserVersion: '3.0'
    });

    try {
      let count = 0;
      const batchSize = 1000;

      // 5. Transformación y Carga por Lotes
      if (reportType === 'expanded_transactions') {
        const transactions = parseTransactions(parseResult.data, propertyId, importFile.id);
        console.log(`[IMPORT] Parsed ${transactions.length} transactions. Starting database upload...`);
        for (let i = 0; i < transactions.length; i += batchSize) {
          const batch = transactions.slice(i, i + batchSize);
          await database.insertTransactions(batch);
        }
        count = transactions.length;
      } else if (reportType === 'reservations_financials') {
        const reservations = parseReservations(parseResult.data, propertyId, importFile.id);
        console.log(`[IMPORT] Parsed ${reservations.length} reservations. Starting database upload...`);
        for (let i = 0; i < reservations.length; i += batchSize) {
          const batch = reservations.slice(i, i + batchSize);
          await database.insertReservations(batch);
        }
        count = reservations.length;
      }

      // 6. Finalización
      await database.updateImportFile(importFile.id, { status: 'processed' });
      logger.success('IMPORT', `Successfully imported ${count} records from ${filename}`);
      
      // Invalidar caché
      cacheService.clear();

      return { 
        success: true, 
        reportType, 
        rowCount: count,
        detectedCurrency,
        warnings: validation.warnings 
      };

    } catch (processError: any) {
      logger.error('IMPORT', 'Processing error', processError);
      await database.updateImportFile(importFile.id, { status: 'failed' });
      return { success: false, error: processError.message || 'Error al procesar los datos en la base de datos' };
    }
  } catch (error: any) {
    logger.error('IMPORT', 'Critical import error', error);
    return { success: false, error: error.message || 'Error interno del servidor al procesar el archivo' };
  }
}

export function validateCSV(content: string): any {
  try {
    const parseResult = parseCSV(content);
    if (parseResult.data.length === 0) {
      return { success: false, error: 'El archivo está vacío' };
    }

    const headers = Object.keys(parseResult.data[0]);
    const reportType = detectReportType(headers);
    const validation = validateReport(parseResult.data, reportType as ReportType);

    return { 
      success: true, 
      isValid: validation.isValid,
      reportType, 
      validation,
      missingRequired: validation.missingRequired,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
