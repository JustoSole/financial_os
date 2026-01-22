import fs from 'fs';
import path from 'path';
import database from './db';
import { importCSV } from './services/import-service';
import { nanoid } from 'nanoid';

const SAMPLE_DATA_DIR = path.join(__dirname, '../../sample-data');

export async function seedDatabase() {
  const existingProperty = database.getProperty();
  
  // Only seed if no property exists or if it has no data
  const health = existingProperty ? database.getDataHealth(existingProperty.id) : null;
  
  if (existingProperty && health && health.score > 0) {
    console.log('⏩ Database already has data, skipping seed.');
    return;
  }

  console.log('🌱 Seeding database with sample data...');

  // 1. Create or get property
  let propertyId: string;
  if (!existingProperty) {
    const id = nanoid();
    database.insertProperty({
      id,
      name: 'Hotel Demo Beta',
      currency: 'USD',
      timezone: 'America/Argentina/Buenos_Aires',
      plan: 'pro',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    propertyId = id;
    console.log(`✅ Created demo property: ${propertyId}`);
  } else {
    propertyId = existingProperty.id;
  }

  // 2. Load Sample CSVs
  const filesToImport = [
    { name: 'Reservations with Financials.csv', type: 'reservations_financials' },
    { name: 'Expanded Transaction Report with Details.csv', type: 'expanded_transactions' },
    { name: 'Channel Performance Summary.csv', type: 'channel_performance' },
  ];

  for (const file of filesToImport) {
    const filePath = path.join(SAMPLE_DATA_DIR, file.name);
    if (fs.existsSync(filePath)) {
      console.log(` importando ${file.name}...`);
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        const result = await importCSV(propertyId, file.name, content);
        if (result.success) {
          console.log(` ✅ ${file.name} importado con éxito (${result.rowsProcessed} filas)`);
        } else {
          console.warn(` ⚠️ Error importando ${file.name}:`, result.errors);
        }
      } catch (err) {
        console.error(` ❌ Error fatal importando ${file.name}:`, err);
      }
    } else {
      console.warn(` ⚠️ Archivo no encontrado: ${filePath}`);
    }
  }

  // 3. Set Reasonable Costs (13 rooms)
  // Basado en 13 habitaciones, USD
  const demoCosts = {
    room_count: 13,
    starting_cash_balance: 5000,
    fixed_categories: [
      { id: nanoid(), name: 'Alquiler / Hipoteca', monthlyAmount: 2500 },
      { id: nanoid(), name: 'Sueldos y Cargas Sociales', monthlyAmount: 3500 },
      { id: nanoid(), name: 'Servicios (Luz, Agua, Gas, Internet)', monthlyAmount: 800 },
      { id: nanoid(), name: 'Software (Cloudbeds, etc)', monthlyAmount: 300 },
      { id: nanoid(), name: 'Marketing y Publicidad', monthlyAmount: 500 },
      { id: nanoid(), name: 'Mantenimiento General', monthlyAmount: 400 },
    ],
    variable_categories: [
      { id: nanoid(), name: 'Limpieza por estadía (Promedio)', monthlyAmount: 15 }, // Usado como base
      { id: nanoid(), name: 'Lavandería Mensual', monthlyAmount: 600 },
      { id: nanoid(), name: 'Amenities y Suministros', monthlyAmount: 300 },
    ],
    // Legacy support
    fixed_costs: {
      salaries: 3500,
      rent: 2500,
      utilities: 1100, // utilities + software
      other: 900, // marketing + maintenance
    },
    variable_costs: {
      cleaningPerStay: 15,
      laundryMonthly: 600,
      amenitiesMonthly: 300,
    },
    channel_commissions: {
      defaultRate: 0.15,
      byChannel: {
        'Booking.com': 0.18,
        'Expedia': 0.20,
        'Airbnb': 0.03,
        'Directo': 0,
      },
    },
    payment_fees: {
      enabled: true,
      defaultRate: 0.03,
      byMethod: {
        'Cash': 0,
        'Credit Card': 0.035,
        'Bank Transfer': 0.01,
      },
    },
  };

  database.upsertCostSettings(propertyId, demoCosts);
  console.log('✅ Costos demo configurados (13 habitaciones)');
  
  console.log('✨ Seed finalizado con éxito.');
}

