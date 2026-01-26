export * from './csv-parser';
export * from './types';
export * from './transaction-parser';
export * from './reservation-parser';

import { findColumn, normalizeDecimal, normalizeDateTime, normalizeDate, generateRowHash } from './csv-parser';

// =====================================================
// Wrapper functions for pre-parsed data (used by import-service)
// =====================================================

/**
 * Parse transactions from already-parsed CSV data
 */
export function parseTransactions(data: Record<string, string>[], propertyId: string, fileId: string) {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
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
  
  const transactions: any[] = [];
  
  for (const row of data) {
    const isVoid = voidFlagCol ? parseBool(row[voidFlagCol]) : false;
    if (isVoid) continue;
    
    const debits = debitsCol ? normalizeDecimal(row[debitsCol]) : 0;
    const credits = creditsCol ? normalizeDecimal(row[creditsCol]) : 0;
    if (debits === 0 && credits === 0) continue;
    
    const txnAt = txnDateCol ? normalizeDateTime(row[txnDateCol]) : null;
    if (!txnAt) continue;
    
    transactions.push({
      propertyId,
      sourceFileId: fileId,
      txnAt,
      reservationNumber: reservationNumCol ? extractResNum(row[reservationNumCol]) : null,
      reservationSource: reservationSourceCol ? row[reservationSourceCol] || null : null,
      txnType: txnTypeCol ? row[txnTypeCol] || null : null,
      debits,
      credits,
      voidFlag: false,
      refundFlag: refundFlagCol ? parseBool(row[refundFlagCol]) : false,
      adjustmentFlag: adjustmentFlagCol ? parseBool(row[adjustmentFlagCol]) : false,
      description: descriptionCol ? row[descriptionCol] || null : null,
      notes: notesCol ? row[notesCol] || null : null,
      txnSource: txnSourceCol ? row[txnSourceCol] || null : null,
      rowHash: generateRowHash(row)
    });
  }
  
  return transactions;
}

/**
 * Parse reservations from already-parsed CSV data
 */
export function parseReservations(data: Record<string, string>[], propertyId: string, fileId: string) {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
  const reservationNumCol = findColumn(headers, 'reservation_number');
  const guestNameCol = findColumn(headers, 'primary_guest_full_name');
  const statusCol = findColumn(headers, 'reservation_status');
  const sourceCategoryCol = findColumn(headers, 'reservation_source_category') || findColumn(headers, 'source_category');
  const sourceCol = findColumn(headers, 'reservation_source') || findColumn(headers, 'source');
  const checkInCol = findColumn(headers, 'check_in_date');
  const checkOutCol = findColumn(headers, 'check_out_date');
  const roomNightsCol = findColumn(headers, 'room_nights');
  const roomRevenueCol = findColumn(headers, 'room_revenue_total');
  const taxesCol = findColumn(headers, 'total_reservation_taxes');
  const paidAmountCol = findColumn(headers, 'reservation_paid_amount');
  const balanceDueCol = findColumn(headers, 'reservation_balance_due');
  const suggestedDepositCol = findColumn(headers, 'suggested_deposit');
  const hotelCollectCol = findColumn(headers, 'hotel_collect_booking_flag');
  
  const reservations: any[] = [];
  const seen = new Set<string>();
  
  console.log(`[PARSER] Starting parseReservations for ${data.length} rows. ResNumCol: ${reservationNumCol}, CheckInCol: ${checkInCol}`);

  for (const row of data) {
    const rawResNum = row[reservationNumCol!];
    const resNum = reservationNumCol ? extractResNum(rawResNum) : null;
    
    if (!resNum) {
      if (rawResNum && rawResNum.trim() !== '') {
        // console.log(`[PARSER] Row skipped: No resNum extracted from "${rawResNum}"`);
      }
      continue;
    }

    if (seen.has(resNum)) continue;
    seen.add(resNum);
    
    // Validar que tengamos fechas básicas
    const rawCheckIn = row[checkInCol!];
    const rawCheckOut = row[checkOutCol!];
    const checkIn = normalizeDate(rawCheckIn);
    const checkOut = normalizeDate(rawCheckOut);
    
    if (!checkIn || !checkOut) {
      console.log(`[PARSER] Row skipped: Invalid dates for ${resNum}. In: ${rawCheckIn}, Out: ${rawCheckOut}`);
      continue;
    }
    
    reservations.push({
      propertyId,
      sourceFileId: fileId,
      reservationNumber: resNum,
      guestName: guestNameCol ? extractGuestName(row[guestNameCol]) : null,
      status: statusCol ? row[statusCol] || 'Unknown' : 'Unknown',
      sourceCategory: sourceCategoryCol ? row[sourceCategoryCol] || null : null,
      source: sourceCol ? row[sourceCol] || null : null,
      checkIn,
      checkOut,
      roomNights: roomNightsCol ? Math.round(normalizeDecimal(row[roomNightsCol])) : 0,
      roomRevenueTotal: roomRevenueCol ? normalizeDecimal(row[roomRevenueCol]) : 0,
      taxesTotal: taxesCol ? normalizeDecimal(row[taxesCol]) : 0,
      paidAmount: paidAmountCol ? normalizeDecimal(row[paidAmountCol]) : 0,
      balanceDue: balanceDueCol ? normalizeDecimal(row[balanceDueCol]) : 0,
      suggestedDeposit: suggestedDepositCol ? normalizeDecimal(row[suggestedDepositCol]) : 0,
      hotelCollectFlag: hotelCollectCol ? parseBool(row[hotelCollectCol]) : false,
    });
  }
  
  console.log(`[PARSER] Finished parseReservations. Extracted ${reservations.length} valid reservations.`);
  return reservations;
}

// Helper functions
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === 'sí' || lower === 'si' || lower === '1';
}

function extractResNum(value: string | undefined): string | null {
  if (!value) return null;
  
  const strValue = String(value);

  // Si es una URL de Cloudbeds
  if (strValue.includes('cloudbeds.com') && strValue.includes('/reservations/')) {
    const match = strValue.match(/\/reservations\/(\d+)/);
    if (match) return match[1];
  }
  
  // Si contiene una URL pero no el patrón estándar, intentar extraer cualquier número largo
  if (strValue.includes('http')) {
    const match = strValue.match(/(\d{8,})/); // IDs de Cloudbeds suelen ser largos
    if (match) return match[1];
  }

  const cleaned = strValue.trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned;
  }

  // Fallback para cualquier número largo en el string
  const numMatch = cleaned.match(/(\d{8,})/);
  if (numMatch) return numMatch[1];

  return cleaned || null;
}

function extractGuestName(value: string | undefined): string | null {
  if (!value) return null;
  if (value.includes('cloudbeds.com') && value.includes('display=')) {
    const match = value.match(/display=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]).replace(/\s+/g, ' ').trim() || null;
      } catch {
        return match[1].replace(/%20/g, ' ').trim() || null;
      }
    }
  }
  const cleaned = value.trim();
  return cleaned && cleaned !== '-' && !cleaned.includes('http') ? cleaned : null;
}
