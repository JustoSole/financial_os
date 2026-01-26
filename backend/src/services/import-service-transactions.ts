import database from '../db';
import { parseTransactions } from '../parsers';

export async function processTransactions(propertyId: string, fileId: string, data: any[]) {
  const transactions = parseTransactions(data, propertyId, fileId);
  
  // Usar replaceTransactionsByFile para una operación más "atómica"
  // (aunque Supabase REST no soporta transacciones reales, esto reduce la ventana de inconsistencia)
  // Para archivos grandes, seguimos usando lotes pero el primer lote borra el archivo.
  
  if (transactions.length <= 1000) {
    await database.replaceTransactionsByFile(fileId, transactions);
  } else {
    // Si es muy grande, borramos primero y luego insertamos en lotes
    // TODO: Implementar RPC en Supabase para transacciones reales
    await database.clearTransactionsByFile(fileId);
    
    const batchSize = 500;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      await database.insertTransactions(batch);
    }
  }
  
  return { success: true, count: transactions.length };
}

