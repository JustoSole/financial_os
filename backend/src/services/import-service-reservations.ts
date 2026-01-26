import database from '../db';
import { parseReservations } from '../parsers';

export async function processReservations(propertyId: string, fileId: string, data: any[]) {
  const reservations = parseReservations(data, propertyId, fileId);
  
  // Usar replaceReservationsByFile para mayor consistencia
  if (reservations.length <= 1000) {
    await database.replaceReservationsByFile(fileId, reservations);
  } else {
    await database.clearReservationsByFile(fileId);
    
    const batchSize = 500;
    for (let i = 0; i < reservations.length; i += batchSize) {
      const batch = reservations.slice(i, i + batchSize);
      await database.insertReservations(batch);
    }
  }
  
  return { success: true, count: reservations.length };
}

