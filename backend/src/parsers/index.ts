export * from './csv-parser';
export * from './types';
export * from './transaction-parser';
export * from './reservation-parser';
export * from './channel-parser';

import { findColumn, normalizeDecimal, normalizeDateTime, normalizeDate } from './csv-parser';

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
  
  for (const row of data) {
    const resNum = reservationNumCol ? extractResNum(row[reservationNumCol]) : null;
    if (!resNum || seen.has(resNum)) continue;
    seen.add(resNum);
    
    reservations.push({
      propertyId,
      sourceFileId: fileId,
      reservationNumber: resNum,
      guestName: guestNameCol ? extractGuestName(row[guestNameCol]) : null,
      status: statusCol ? row[statusCol] || 'Unknown' : 'Unknown',
      sourceCategory: sourceCategoryCol ? row[sourceCategoryCol] || null : null,
      source: sourceCol ? row[sourceCol] || null : null,
      checkIn: checkInCol ? normalizeDate(row[checkInCol]) : null,
      checkOut: checkOutCol ? normalizeDate(row[checkOutCol]) : null,
      roomNights: roomNightsCol ? Math.round(normalizeDecimal(row[roomNightsCol])) : 0,
      roomRevenueTotal: roomRevenueCol ? normalizeDecimal(row[roomRevenueCol]) : 0,
      taxesTotal: taxesCol ? normalizeDecimal(row[taxesCol]) : 0,
      paidAmount: paidAmountCol ? normalizeDecimal(row[paidAmountCol]) : 0,
      balanceDue: balanceDueCol ? normalizeDecimal(row[balanceDueCol]) : 0,
      suggestedDeposit: suggestedDepositCol ? normalizeDecimal(row[suggestedDepositCol]) : 0,
      hotelCollectFlag: hotelCollectCol ? parseBool(row[hotelCollectCol]) : false,
    });
  }
  
  return reservations;
}

/**
 * Parse channels from already-parsed CSV data
 */
export function parseChannels(data: Record<string, string>[], propertyId: string, fileId: string) {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
  const sourceCategoryCol = findColumn(headers, 'source_category');
  const sourceCol = findColumn(headers, 'source');
  const roomNightsCol = findColumn(headers, 'room_nights');
  const roomRevenueCol = findColumn(headers, 'room_revenue_total');
  const estimatedCommissionCol = findColumn(headers, 'estimated_commission');
  
  const channels: any[] = [];
  
  for (const row of data) {
    const source = sourceCol ? row[sourceCol]?.trim() : null;
    if (!source) continue;
    
    channels.push({
      propertyId,
      sourceFileId: fileId,
      sourceCategory: sourceCategoryCol ? row[sourceCategoryCol] || null : null,
      source,
      roomNights: roomNightsCol ? Math.round(normalizeDecimal(row[roomNightsCol])) : 0,
      roomRevenueTotal: roomRevenueCol ? normalizeDecimal(row[roomRevenueCol]) : 0,
      estimatedCommission: estimatedCommissionCol ? normalizeDecimal(row[estimatedCommissionCol]) : 0,
    });
  }
  
  return channels;
}

// Helper functions
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === 'sí' || lower === 'si' || lower === '1';
}

function extractResNum(value: string | undefined): string | null {
  if (!value) return null;
  if (value.includes('cloudbeds.com') && value.includes('/reservations/')) {
    const match = value.match(/\/reservations\/(\d+)/);
    if (match) return match[1];
  }
  const cleaned = value.trim();
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
