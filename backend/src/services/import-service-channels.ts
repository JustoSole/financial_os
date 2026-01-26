import database from '../db';
import { parseChannels } from '../parsers';

export async function processChannels(propertyId: string, fileId: string, data: any[]) {
  const channels = parseChannels(data, propertyId, fileId);
  
  // Usar replaceChannelsByFile
  await database.replaceChannelsByFile(fileId, channels);
  
  return { success: true, count: channels.length };
}

