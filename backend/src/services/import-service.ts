import { 
  ReportType, 
  VariableCostsInput,
  FixedCostsInput,
  ChannelCommissions,
  PaymentFees,
  calculateTotalFixedCosts,
} from '../types';
import database from '../db';
import { parseCSV, detectReportType, validateReport } from '../parsers';
import { processTransactions } from './import-service-transactions';
import { processReservations } from './import-service-reservations';
import { processChannels } from './import-service-channels';
import { cacheService } from './cache-service';
import logger from './logger';

/**
 * Import Service - Handles CSV parsing and data ingestion
 */
export async function importCSV(propertyId: string, filename: string, content: string): Promise<any> {
  logger.info('IMPORT', `Starting import for file: ${filename}`, { propertyId });
  try {
    const parseResult = parseCSV(content);
    logger.debug('IMPORT', `CSV Parsed. Rows found: ${parseResult.data.length}. Delimiter: ${parseResult.meta.delimiter}`);
    
    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      logger.error('IMPORT', 'Parse errors detected', parseResult.errors);
      return { success: false, error: 'Error al leer el archivo CSV', details: parseResult.errors };
    }

    const headers = Object.keys(parseResult.data[0] || {});
    logger.debug('IMPORT', 'Detected Headers', headers);
    
    const reportType = detectReportType(headers);
    logger.info('IMPORT', `Detected Report Type: ${reportType}`);

    if (reportType === 'unknown') {
      logger.error('IMPORT', 'Unknown report type for headers', { headers, sample: parseResult.data[0] });
      return { 
        success: false, 
        error: 'No se pudo identificar el reporte. Asegurate de exportar el reporte de Cloudbeds en formato "Table" o "Details Only" y que las columnas no hayan sido modificadas.', 
        details: { headers, sample: parseResult.data[0] } 
      };
    }

    const validation = validateReport(parseResult.data, reportType);
    logger.info('IMPORT', `Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
    
    if (!validation.isValid) {
      logger.error('IMPORT', 'Missing columns', validation.missingRequired);
      const missingNames = validation.missingRequired.join(', ');
      return { 
        success: false, 
        error: `Al reporte le faltan columnas obligatorias: ${missingNames}. Por favor, volvé a exportar el reporte original de Cloudbeds sin modificar los encabezados.`,
        details: validation
      };
    }

    // Registrar inicio de importación
    const importFile = await database.insertImportFile({
      propertyId,
      reportType,
      filename,
      rows: parseResult.data.length,
      warningsCount: validation.warnings.length,
      status: 'processing',
      parserVersion: '2.0'
    });

    let result;
    try {
      if (reportType === 'expanded_transactions') {
        logger.info('IMPORT', 'Processing Transactions...');
        result = await processTransactions(propertyId, importFile.id, parseResult.data);
      } else if (reportType === 'reservations_financials') {
        logger.info('IMPORT', 'Processing Reservations...');
        result = await processReservations(propertyId, importFile.id, parseResult.data);
      } else if (reportType === 'channel_performance') {
        logger.info('IMPORT', 'Processing Channels...');
        result = await processChannels(propertyId, importFile.id, parseResult.data);
      }

      await database.updateImportFile(importFile.id, { status: 'processed' });
      logger.success('IMPORT', `Successfully imported ${parseResult.data.length} rows of type ${reportType}`);
      
      // Invalidar caché tras importación exitosa (Issue D)
      cacheService.clear();

      return { 
        success: true, 
        reportType, 
        rowCount: parseResult.data.length,
        warnings: validation.warnings 
      };
    } catch (processError: any) {
      logger.error('IMPORT', 'Processing error', processError);
      await database.updateImportFile(importFile.id, { status: 'failed' });
      return { success: false, error: processError.message || 'Error al procesar los datos' };
    }
  } catch (error: any) {
    logger.error('IMPORT', 'Critical import error', error);
    return { success: false, error: error.message || 'Error interno al procesar el archivo' };
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
      isValid: validation.isValid,  // Frontend expects "isValid"
      reportType, 
      validation,
      missingRequired: validation.missingRequired,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
