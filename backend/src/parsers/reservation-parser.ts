import { parseCSV, normalizeDecimal, normalizeDate, findColumn } from './csv-parser';
import { ParsedReservation } from './types';

// =====================================================
// Reservations with Financials Parser
// Columns from actual Cloudbeds export:
// - Reservation Number, Reservation Status
// - Reservation Source Category, Reservation Source
// - Primary Guest Full Name (as URL with display param)
// - Check-In Date, Check-Out Date, Room Nights
// - Room Revenue Total, Total Reservation Taxes
// - Reservation Paid Amount, Reservation Balance Due
// - Suggested Deposit, Hotel Collect Booking Flag
// =====================================================

export function parseReservationsReport(content: string): {
  reservations: ParsedReservation[];
  warnings: string[];
  errors: string[];
} {
  const result = parseCSV(content);
  const warnings: string[] = [];
  const errors: string[] = [];
  const reservations: ParsedReservation[] = [];
  
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => e.message));
  }
  
  const headers = result.data.length > 0 ? Object.keys(result.data[0]) : [];
  
  // Find columns
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
  
  // Validate required columns
  if (!reservationNumCol) {
    errors.push('No se encontró columna "Reservation Number" - requerida');
  }
  if (!paidAmountCol) {
    errors.push('No se encontró columna "Reservation Paid Amount" - requerida');
  }
  if (!balanceDueCol) {
    errors.push('No se encontró columna "Reservation Balance Due" - requerida');
  }
  
  if (errors.length > 0) {
    return { reservations, warnings, errors };
  }
  
  let skippedInvalid = 0;
  const seenReservations = new Set<string>();
  
  for (const row of result.data) {
    try {
      // Extract reservation number
      const rawResNum = row[reservationNumCol!];
      const reservationNumber = extractReservationNumber(rawResNum);
      
      if (!reservationNumber) {
        // Log skip for debugging
        if (rawResNum && rawResNum.trim() !== '') {
          console.log(`[PARSER] Skipping row: Invalid reservation number "${rawResNum}"`);
        }
        skippedInvalid++;
        continue;
      }
      
      // Skip duplicates (in case of multi-row reservations)
      if (seenReservations.has(reservationNumber)) {
        continue;
      }
      seenReservations.add(reservationNumber);
      
      // Extract guest name (from URL or plain text)
      const guestName = guestNameCol ? extractGuestName(row[guestNameCol]) : null;
      
      // Parse dates
      const rawCheckIn = row[checkInCol!];
      const rawCheckOut = row[checkOutCol!];
      const checkIn = normalizeDate(rawCheckIn);
      const checkOut = normalizeDate(rawCheckOut);
      
      if (!checkIn || !checkOut) {
        console.log(`[PARSER] Warning: Invalid dates for res ${reservationNumber}. In: ${rawCheckIn}, Out: ${rawCheckOut}`);
        warnings.push(`Reserva ${reservationNumber}: fechas inválidas (${rawCheckIn} / ${rawCheckOut})`);
      }
      
      // Parse amounts
      const roomRevenueTotal = roomRevenueCol ? normalizeDecimal(row[roomRevenueCol]) : 0;
      const taxesTotal = taxesCol ? normalizeDecimal(row[taxesCol]) : 0;
      const paidAmount = paidAmountCol ? normalizeDecimal(row[paidAmountCol]) : 0;
      const balanceDue = balanceDueCol ? normalizeDecimal(row[balanceDueCol]) : 0;
      const suggestedDeposit = suggestedDepositCol ? normalizeDecimal(row[suggestedDepositCol]) : 0;
      const roomNights = roomNightsCol ? Math.round(normalizeDecimal(row[roomNightsCol])) : 0;
      
      // LOG TEMPORAL PARA DEBUG DE MONTOS
      if (reservationNumber === '152874952' || reservationNumber.includes('152874952')) {
        console.log(`[PARSER] Debug Res ${reservationNumber}: Revenue=${roomRevenueTotal}, Paid=${paidAmount}, Balance=${balanceDue}`);
      }
      
      // Parse status
      const status = statusCol ? row[statusCol] || 'Unknown' : 'Unknown';
      
      // Parse hotel collect flag
      const hotelCollectFlag = hotelCollectCol ? parseBooleanFlag(row[hotelCollectCol]) : false;
      
      reservations.push({
        reservationNumber,
        guestName,
        status,
        sourceCategory: sourceCategoryCol ? row[sourceCategoryCol] || null : null,
        source: sourceCol ? row[sourceCol] || null : null,
        checkIn: checkIn || '',
        checkOut: checkOut || '',
        roomNights,
        roomRevenueTotal,
        taxesTotal,
        paidAmount,
        balanceDue,
        suggestedDeposit,
        hotelCollectFlag,
      });
    } catch (e) {
      warnings.push(`Error procesando fila: ${e}`);
    }
  }
  
  if (skippedInvalid > 0) {
    warnings.push(`Se ignoraron ${skippedInvalid} filas con número de reserva inválido`);
  }
  
  return { reservations, warnings, errors };
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
 */
function extractReservationNumber(value: string | undefined): string | null {
  if (!value) return null;
  
  const strValue = String(value);

  // Check if it's a URL
  if (strValue.includes('cloudbeds.com') && strValue.includes('/reservations/')) {
    const match = strValue.match(/\/reservations\/(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Otherwise return as-is if it looks valid
  const cleaned = strValue.trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned;
  }
  
  // If it's a long string but contains a number, try to extract it
  const numMatch = cleaned.match(/(\d{8,})/);
  if (numMatch) return numMatch[1];

  return cleaned || null;
}

/**
 * Extract guest name from Cloudbeds URL or plain text
 * URLs look like: https://us1.cloudbeds.com/connect/22593#/reservations/152874952?display=GUEST%20NAME&...
 */
function extractGuestName(value: string | undefined): string | null {
  if (!value) return null;
  
  // Check if it's a URL with display parameter
  if (value.includes('cloudbeds.com') && value.includes('display=')) {
    const match = value.match(/display=([^&]+)/);
    if (match) {
      // Decode URI component and clean up
      try {
        const decoded = decodeURIComponent(match[1]);
        // Clean up the name (remove extra spaces, normalize case)
        return decoded.replace(/\s+/g, ' ').trim() || null;
      } catch {
        return match[1].replace(/%20/g, ' ').trim() || null;
      }
    }
  }
  
  // If not a URL or URL parsing failed, return as-is if it looks like a name
  const cleaned = value.trim();
  if (cleaned && cleaned !== '-' && !cleaned.includes('http')) {
    return cleaned;
  }
  
  return null;
}

