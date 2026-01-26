import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import database from '../db';
import { supabase } from '../db/supabase-client';
import cacheService from '../services/cache-service';
import { importCSV, validateCSV } from '../services/import-service';
import { 
  calculateHomeMetrics, 
  calculateCashMetrics, 
  calculateChannelMetrics, 
  getCollectionsData,
  getDailyFlow,
  calculateRevenueProjection,
  calculateMoMComparison,
  calculateStructureMetrics,
  calculateReconciliation,
  getARAging,
  getMinimumPriceSimulation,
  calculateDOWPerformance,
  calculateYoYComparison,
} from '../services/metrics-service';
import { generateActions, completeActionStep, getCompletedSteps } from '../services/actions-service';
import { generateInsights } from '../services/insights-service';
import {
  calculateReservationEconomicsSummary,
  getReservationEconomicsList,
  getReservationEconomicsDetail,
} from '../services/reservation-economics-service';
import { getCommandCenterData, getBreakEvenAnalysis } from '../services/command-center-service';
import { calculateTrendMetrics } from '../services/trends-service';

const router = Router();

// Middleware to verify Supabase JWT
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'financial-os-backend'
  });
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.originalname.endsWith('.csv') ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos CSV'));
    }
  },
});

// =====================================================
// Property Routes
// =====================================================

// Get or create default property
router.get('/property', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log(`📋 GET /api/property - User: ${user.email}`);
    
    // Buscar propiedad del usuario
    let property = await database.getPropertyByUser(user.id);
    console.log('📋 Property from DB:', property ? 'Found' : 'Not found');
    
    if (!property) {
      console.log('📋 Creating default property for user...');
      const id = uuidv4();
      property = await database.insertProperty({
        id,
        user_id: user.id,
        name: 'Mi Hotel',
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
        plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log('📋 Default property created:', id);
      
      // Create default cost settings
      await database.upsertCostSettings(id, {});
      console.log('📋 Default cost settings created');
    }
    
    console.log('📋 Returning property:', property.id);
    res.json({ success: true, data: property });
  } catch (error: any) {
    console.error('❌ Error in /api/property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update property
router.put('/property/:id', async (req: Request, res: Response) => {
  try {
    const { name, currency, timezone } = req.body;
    const property = await database.updateProperty(req.params.id, {
      name,
      currency,
      timezone,
      updated_at: new Date().toISOString(),
    });
    
    cacheService.clear();
    res.json({ success: true, data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Import Routes
// =====================================================

// Validate CSV without importing
router.post('/import/validate', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió archivo' });
    }
    
    const content = req.file.buffer.toString('utf-8');
    const result = validateCSV(content);
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import CSV
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió archivo' });
    }
    
    const propertyId = req.body.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Falta propertyId' });
    }
    
    const content = req.file.buffer.toString('utf-8');
    const result = await importCSV(propertyId, req.file.originalname, content);
    
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import multiple CSVs
router.post('/import/batch', upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se recibieron archivos' });
    }
    
    const propertyId = req.body.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Falta propertyId' });
    }
    
    const results = [];
    for (const file of files) {
      const content = file.buffer.toString('utf-8');
      const result = await importCSV(propertyId, file.originalname, content);
      results.push(result);
    }
    
    const allSuccess = results.every(r => r.success);
    res.json({ 
      success: allSuccess, 
      data: { results },
      message: allSuccess ? 'Todos los archivos procesados correctamente' : 'Algunos archivos tuvieron errores'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get import history
router.get('/import/history/:propertyId', async (req: Request, res: Response) => {
  try {
    const files = await database.getImportFilesByProperty(req.params.propertyId, 20);
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Metrics Routes
// =====================================================

// Get home dashboard metrics (4 tiles)
router.get('/metrics/:propertyId', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = await calculateHomeMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      metrics = await calculateHomeMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Command Center - All key metrics unified (responds to 40 key questions)
router.get('/metrics/:propertyId/command-center', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await getCommandCenterData(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = await getCommandCenterData(req.params.propertyId, d);
    }
    
    // Ensure success: true and standardized data structure
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error in /metrics/:propertyId/command-center:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al procesar el Command Center',
      message: error.message 
    });
  }
});

// Get cash view metrics (runway, daily flow, alerts)
router.get('/metrics/:propertyId/cash', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = await calculateCashMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      metrics = await calculateCashMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get channel metrics (donut, dependency, savings)
router.get('/metrics/:propertyId/channels', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = await calculateChannelMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      metrics = await calculateChannelMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collections data (reservations with balance due)
router.get('/metrics/:propertyId/collections', async (req: Request, res: Response) => {
  try {
    const data = await getCollectionsData(req.params.propertyId);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get daily flow for chart
router.get('/metrics/:propertyId/daily-flow', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const d = parseInt(days as string) || 30;
    const data = await getDailyFlow(req.params.propertyId, d);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get revenue projection (future bookings)
router.get('/metrics/:propertyId/projection', async (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const data = await calculateRevenueProjection(req.params.propertyId, weeks);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get period comparison (this month vs previous)
router.get('/metrics/:propertyId/comparison', async (req: Request, res: Response) => {
  try {
    const data = await calculateMoMComparison(req.params.propertyId);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get structure metrics (Occupancy, ADR, RevPAR, GOPPAR)
router.get('/metrics/:propertyId/structure', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await calculateStructureMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = await calculateStructureMetrics(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get reconciliation metrics (Charged vs Collected)
router.get('/metrics/:propertyId/reconcile', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await calculateReconciliation(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = await calculateReconciliation(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get A/R aging
router.get('/metrics/:propertyId/ar-aging', async (req: Request, res: Response) => {
  try {
    const data = await getARAging(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get break-even metrics
router.get('/metrics/:propertyId/breakeven', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await getBreakEvenAnalysis(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = await getBreakEvenAnalysis(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get minimum price simulation
router.get('/metrics/:propertyId/minimum-price', async (req: Request, res: Response) => {
  try {
    const margin = parseFloat(req.query.margin as string) || 0;
    const data = await getMinimumPriceSimulation(req.params.propertyId, margin);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get intelligent insights
router.get('/metrics/:propertyId/insights', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let insights;
    
    if (startDate && endDate) {
      insights = await generateInsights(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      insights = await generateInsights(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: insights });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get trends
router.get('/metrics/:propertyId/trends', async (req: Request, res: Response) => {
  try {
    const { months } = req.query;
    const data = await calculateTrendMetrics(req.params.propertyId, parseInt(months as string) || 6);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get DOW performance
router.get('/metrics/:propertyId/dow', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await calculateDOWPerformance(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      data = await calculateDOWPerformance(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get YoY comparison
router.get('/metrics/:propertyId/yoy', async (req: Request, res: Response) => {
  try {
    const data = await calculateYoYComparison(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Reservation Economics Routes (P&L por reserva)
// =====================================================

// Get reservation economics summary (aggregates + patterns + worst)
router.get('/metrics/:propertyId/reservation-economics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = await calculateReservationEconomicsSummary(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = await calculateReservationEconomicsSummary(req.params.propertyId, d);
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all reservation economics (full list with filters)
router.get('/metrics/:propertyId/reservation-economics/list', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days, source, unprofitableOnly } = req.query;
    
    let data;
    if (startDate && endDate) {
      data = await getReservationEconomicsList(req.params.propertyId, startDate as string, endDate as string, { source: source as any, unprofitableOnly: unprofitableOnly === 'true' } as any);
    } else {
      const d = parseInt(days as string) || 30;
      data = await getReservationEconomicsList(req.params.propertyId, d, { source: source as any, unprofitableOnly: unprofitableOnly === 'true' } as any);
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single reservation economics detail
router.get('/metrics/:propertyId/reservation-economics/:reservationNumber', async (req: Request, res: Response) => {
  try {
    const data = await getReservationEconomicsDetail(
      req.params.propertyId, 
      req.params.reservationNumber
    );
    
    if (!data) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unprofitable reservations only (helper endpoint)
router.get('/metrics/:propertyId/unprofitable', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const d = parseInt(days as string) || 30;
    const data = await getReservationEconomicsList(req.params.propertyId, d, { unprofitableOnly: true } as any);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Actions Routes
// =====================================================

// Get recommended actions
router.get('/actions/:propertyId', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let actions;
    
    if (startDate && endDate) {
      actions = await generateActions(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      actions = await generateActions(req.params.propertyId, d);
    }
    
    const completed = await getCompletedSteps(req.params.propertyId);
    
    // Merge completion status
    for (const action of actions) {
      if (completed[action.type]) {
        for (let i = 0; i < action.steps.length; i++) {
          if (completed[action.type].includes(i)) {
            action.steps[i].completed = true;
          }
        }
      }
    }
    
    res.json({ success: true, data: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete an action step
router.post('/actions/:propertyId/step', async (req: Request, res: Response) => {
  try {
    const { actionType, stepIndex } = req.body;
    await completeActionStep(req.params.propertyId, actionType, stepIndex);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Cost Settings Routes (V3 - Simplified Zero Friction)
// =====================================================

// Get channels from PMS data (for commission configuration)
router.get('/costs/:propertyId/channels', async (req: Request, res: Response) => {
  try {
    const channels = await database.getChannelsFromPMS(req.params.propertyId);
    res.json({ success: true, data: channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cost settings with occupancy data for auto-calculations
router.get('/costs/:propertyId', async (req: Request, res: Response) => {
  try {
    let costs = await database.getCostSettings(req.params.propertyId);
    
    if (!costs) {
      costs = await database.upsertCostSettings(req.params.propertyId, {});
    }
    
    // Get occupancy stats from PMS data
    const occupancy = await database.getOccupancyStats(req.params.propertyId, 30);
    
    // Calculate totals from V4 categories or legacy V3 fields
    let totalVariableMonthly = 0;
    let totalFixedMonthly = 0;
    
    // V4 flexible categories
    if (costs.variable_categories && costs.variable_categories.length > 0) {
      totalVariableMonthly = costs.variable_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    } else if (costs.variable_costs) {
      // Legacy V3
      totalVariableMonthly = (costs.variable_costs.cleaningPerStay || 0) + 
                             (costs.variable_costs.laundryMonthly || 0) + 
                             (costs.variable_costs.amenitiesMonthly || 0);
    }
    
    if (costs.fixed_categories && costs.fixed_categories.length > 0) {
      totalFixedMonthly = costs.fixed_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    } else if (costs.fixed_costs) {
      // Legacy V3
      totalFixedMonthly = (costs.fixed_costs.salaries || 0) + (costs.fixed_costs.rent || 0) + 
                          (costs.fixed_costs.utilities || 0) + (costs.fixed_costs.other || 0);
    }
    
    const variablePerNight = occupancy.occupiedNights > 0 
      ? totalVariableMonthly / occupancy.occupiedNights 
      : 0;
    const fixedPerDay = totalFixedMonthly / 30.44;
    
    res.json({ 
      success: true, 
      data: {
        ...costs,
        // Include calculated values
        calculated: {
          occupiedNightsLastMonth: occupancy.occupiedNights,
          totalReservationsLastMonth: occupancy.totalReservations,
          avgNightsPerStay: occupancy.avgNightsPerStay,
          variablePerNight: Math.round(variablePerNight),
          totalFixedMonthly: Math.round(totalFixedMonthly),
          fixedPerDay: Math.round(fixedPerDay),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update cost settings (V4 - Flexible Categories)
router.put('/costs/:propertyId', async (req: Request, res: Response) => {
  try {
    const {
      roomCount,
      startingCashBalance,
      cleaningPerStay, // Costo de limpieza por estadía (unit economics real)
      // New V4 flexible categories
      variableCategories,
      fixedCategories,
      extraordinaryCosts,
      // Legacy V3 fields
      variableCosts,
      fixedCosts,
      channelCommissions,
      paymentFees,
    } = req.body;
    
    const updateData: any = {};
    
    if (roomCount !== undefined) {
      updateData.room_count = roomCount;
    }
    
    if (startingCashBalance !== undefined) {
      updateData.starting_cash_balance = startingCashBalance;
    }
    
    // V4 flexible categories (new structure)
    if (variableCategories) {
      updateData.variable_categories = variableCategories;
      
      // Also calculate legacy format for backward compatibility
      const laundryCat = variableCategories.find((c: any) => c.id === 'laundry' || c.name.toLowerCase().includes('lavandería'));
      const amenitiesCat = variableCategories.find((c: any) => c.id === 'amenities' || c.name.toLowerCase().includes('amenities'));
      
      // Store legacy format too - cleaningPerStay se maneja separado ahora
      updateData.variable_costs = {
        cleaningPerStay: cleaningPerStay !== undefined ? cleaningPerStay : 0, // Unit economics real: costo por estadía
        laundryMonthly: laundryCat?.monthlyAmount || 0,
        amenitiesMonthly: amenitiesCat?.monthlyAmount || 0,
      };
    } else if (variableCosts) {
      // V3 legacy variable costs
      updateData.variable_costs = {
        cleaningPerStay: variableCosts.cleaningPerStay,
        laundryMonthly: variableCosts.laundryMonthly,
        amenitiesMonthly: variableCosts.amenitiesMonthly,
      };
    } else if (cleaningPerStay !== undefined) {
      // Solo se actualizó cleaningPerStay
      const existingCosts = await database.getCostSettings(req.params.propertyId);
      updateData.variable_costs = {
        ...existingCosts?.variable_costs,
        cleaningPerStay,
      };
    }
    
    // V4 fixed categories (new structure)
    if (fixedCategories) {
      updateData.fixed_categories = fixedCategories;
      
      // Calculate legacy format for backward compatibility
      const salariesCat = fixedCategories.find((c: any) => c.id === 'salaries' || c.name.toLowerCase().includes('sueldo'));
      const rentCat = fixedCategories.find((c: any) => c.id === 'rent' || c.name.toLowerCase().includes('alquiler'));
      const utilitiesCat = fixedCategories.find((c: any) => c.id === 'utilities' || c.name.toLowerCase().includes('servicio'));
      const otherTotal = fixedCategories
        .filter((c: any) => !['salaries', 'rent', 'utilities'].includes(c.id) && 
          !c.name.toLowerCase().includes('sueldo') && 
          !c.name.toLowerCase().includes('alquiler') && 
          !c.name.toLowerCase().includes('servicio'))
        .reduce((sum: number, c: any) => sum + (c.monthlyAmount || 0), 0);
      
      updateData.fixed_costs = {
        salaries: salariesCat?.monthlyAmount || 0,
        rent: rentCat?.monthlyAmount || 0,
        utilities: utilitiesCat?.monthlyAmount || 0,
        other: otherTotal,
      };
    } else if (fixedCosts) {
      // V3 legacy fixed costs
      updateData.fixed_costs = {
        salaries: fixedCosts.salaries,
        rent: fixedCosts.rent,
        utilities: fixedCosts.utilities,
        other: fixedCosts.other,
      };
    }
    
    if (channelCommissions) {
      updateData.channel_commissions = {
        defaultRate: channelCommissions.defaultRate,
        byChannel: channelCommissions.byChannel,
      };
    }
    
    if (paymentFees) {
      updateData.payment_fees = {
        enabled: paymentFees.enabled,
        defaultRate: paymentFees.defaultRate,
        byMethod: paymentFees.byMethod,
      };
    }
    
    // V4.1: Extraordinary costs
    if (extraordinaryCosts !== undefined) {
      updateData.extraordinary_costs = extraordinaryCosts;
    }
    
    const costs = await database.upsertCostSettings(req.params.propertyId, updateData);
    
    cacheService.clear();
    res.json({ success: true, data: costs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Data Health Route
router.get('/data-health/:propertyId', async (req: Request, res: Response) => {
  try {
    const health = await database.getDataHealth(req.params.propertyId);
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RESET DATABASE Route
router.post('/property/:propertyId/reset', authenticate, async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const user = (req as any).user;
    
    // Verify property belongs to user
    const property = await database.getPropertyById(propertyId);
    if (!property || property.user_id !== user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    await database.resetDatabase(propertyId);
    cacheService.clear();
    
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Telemetry Routes
// =====================================================

// Log event
router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const { propertyId, eventType, eventData } = req.body;
    
    // Verificar si la tabla existe antes de insertar, o manejar el error silenciosamente
    try {
      await database.insertLog({
        id: uuidv4(),
        property_id: propertyId,
        event_type: eventType,
        event_data: JSON.stringify(eventData || {}),
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.warn('⚠️ Telemetry log failed (table might not exist):', dbError);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
