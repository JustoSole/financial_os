import fs from 'fs';
import path from 'path';
import database from './db';
import { importCSV } from './services/import-service';
import { nanoid } from 'nanoid';

const SAMPLE_DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../sample-data') // In production, it will be inside backend/dist/sample-data or similar
  : path.join(__dirname, '../../sample-data');

// =====================================================
// Costos demo por moneda - valores realistas para cada país
// =====================================================
type CurrencyType = 'USD' | 'ARS' | 'MXN' | 'COP' | 'BRL' | 'EUR';

const DEMO_COSTS_BY_CURRENCY: Record<CurrencyType, {
  starting_cash_balance: number;
  fixed: { rent: number; salaries: number; utilities: number; software: number; marketing: number; maintenance: number };
  variable: { cleaning: number; laundry: number; amenities: number };
}> = {
  USD: {
    starting_cash_balance: 5000,
    fixed: { rent: 2500, salaries: 3500, utilities: 800, software: 300, marketing: 500, maintenance: 400 },
    variable: { cleaning: 15, laundry: 600, amenities: 300 },
  },
  ARS: {
    starting_cash_balance: 5000000,
    fixed: { rent: 1500000, salaries: 8000000, utilities: 500000, software: 150000, marketing: 300000, maintenance: 250000 },
    variable: { cleaning: 15000, laundry: 400000, amenities: 200000 },
  },
  MXN: {
    starting_cash_balance: 100000,
    fixed: { rent: 50000, salaries: 70000, utilities: 15000, software: 5000, marketing: 10000, maintenance: 8000 },
    variable: { cleaning: 300, laundry: 12000, amenities: 6000 },
  },
  COP: {
    starting_cash_balance: 20000000,
    fixed: { rent: 10000000, salaries: 15000000, utilities: 3000000, software: 1000000, marketing: 2000000, maintenance: 1500000 },
    variable: { cleaning: 60000, laundry: 2400000, amenities: 1200000 },
  },
  BRL: {
    starting_cash_balance: 25000,
    fixed: { rent: 12000, salaries: 18000, utilities: 4000, software: 1500, marketing: 2500, maintenance: 2000 },
    variable: { cleaning: 80, laundry: 3000, amenities: 1500 },
  },
  EUR: {
    starting_cash_balance: 4500,
    fixed: { rent: 2200, salaries: 3200, utilities: 700, software: 250, marketing: 450, maintenance: 350 },
    variable: { cleaning: 12, laundry: 500, amenities: 250 },
  },
};

function buildDemoCosts(currency: CurrencyType) {
  const costs = DEMO_COSTS_BY_CURRENCY[currency] || DEMO_COSTS_BY_CURRENCY.USD;
  
  return {
    room_count: 13,
    starting_cash_balance: costs.starting_cash_balance,
    fixed_categories: [
      { id: nanoid(), name: 'Alquiler / Hipoteca', monthlyAmount: costs.fixed.rent },
      { id: nanoid(), name: 'Sueldos y Cargas Sociales', monthlyAmount: costs.fixed.salaries },
      { id: nanoid(), name: 'Servicios (Luz, Agua, Gas, Internet)', monthlyAmount: costs.fixed.utilities },
      { id: nanoid(), name: 'Software (Cloudbeds, etc)', monthlyAmount: costs.fixed.software },
      { id: nanoid(), name: 'Marketing y Publicidad', monthlyAmount: costs.fixed.marketing },
      { id: nanoid(), name: 'Mantenimiento General', monthlyAmount: costs.fixed.maintenance },
    ],
    variable_categories: [
      { id: nanoid(), name: 'Limpieza por estadía', monthlyAmount: costs.variable.cleaning },
      { id: nanoid(), name: 'Lavandería Mensual', monthlyAmount: costs.variable.laundry },
      { id: nanoid(), name: 'Amenities y Suministros', monthlyAmount: costs.variable.amenities },
    ],
    // Legacy support
    fixed_costs: {
      salaries: costs.fixed.salaries,
      rent: costs.fixed.rent,
      utilities: costs.fixed.utilities + costs.fixed.software,
      other: costs.fixed.marketing + costs.fixed.maintenance,
    },
    variable_costs: {
      cleaningPerStay: costs.variable.cleaning,
      laundryMonthly: costs.variable.laundry,
      amenitiesMonthly: costs.variable.amenities,
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
}

export async function seedDatabase() {
  const existingProperty = database.getProperty();
  
  // Only seed if no property exists or if it has very low data health
  const health = existingProperty ? database.getDataHealth(existingProperty.id) : null;
  
  // FORCE SEED if score is very low (e.g., 10/100 as seen in the screenshot)
  if (existingProperty && health && health.score > 20) {
    console.log(`⏩ Database already has healthy data (Score: ${health.score}), skipping seed.`);
    return;
  }

  if (existingProperty && health && health.score <= 20) {
    console.log(`🧹 Data health is low (${health.score}/100). Re-seeding to ensure demo data is present...`);
  }

  console.log('🌱 Seeding database with sample data...');

  // 1. Create or get property
  let propertyId: string;
  let detectedCurrency: CurrencyType = 'USD'; // Default
  
  if (!existingProperty) {
    const id = nanoid();
    database.insertProperty({
      id,
      name: 'Hotel Demo Beta',
      currency: 'USD', // Se actualizará automáticamente al importar CSVs
      timezone: 'America/Argentina/Buenos_Aires',
      plan: 'pro',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    propertyId = id;
    console.log(`✅ Created demo property: ${propertyId}`);
  } else {
    propertyId = existingProperty.id;
    detectedCurrency = (existingProperty.currency as CurrencyType) || 'USD';
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
          
          // Capturar la moneda detectada del primer archivo
          if (result.detectedCurrency && result.detectedCurrency !== 'unknown') {
            detectedCurrency = result.detectedCurrency as CurrencyType;
            console.log(` 💱 Moneda detectada: ${detectedCurrency}`);
          }
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

  // 3. Set Reasonable Costs based on detected currency
  // NO sobreescribir si ya hay costos configurados por el usuario
  const existingCosts = database.getCostSettings(propertyId);
  const hasCostsConfigured = existingCosts && (
    (existingCosts.fixed_categories?.length > 0 && existingCosts.fixed_categories.some((c: any) => c.monthlyAmount > 0)) ||
    (existingCosts.variable_categories?.length > 0 && existingCosts.variable_categories.some((c: any) => c.monthlyAmount > 0))
  );
  
  if (!hasCostsConfigured) {
    const demoCosts = buildDemoCosts(detectedCurrency);
    database.upsertCostSettings(propertyId, demoCosts);
    console.log(`✅ Costos demo configurados en ${detectedCurrency} (13 habitaciones)`);
  } else {
    console.log(`⏩ Costos ya configurados por el usuario, no se sobreescriben.`);
  }
  
  console.log('✨ Seed finalizado con éxito.');
}

