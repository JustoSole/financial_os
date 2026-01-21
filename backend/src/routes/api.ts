import { Router, Request, Response } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import database from '../db';
import cacheService from '../services/cache-service';
import { importCSV, validateCSV } from '../services/import-service';
import { 
  calculateHomeMetrics, 
  calculateCashMetrics, 
  calculateChannelMetrics, 
  getCollectionsData,
  getChannelBreakdown,
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
router.get('/property', (req: Request, res: Response) => {
  try {
    let property = database.getProperty();
    
    if (!property) {
      const id = nanoid();
      property = database.insertProperty({
        id,
        name: 'Mi Hotel',
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
        plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      // Create default cost settings
      database.upsertCostSettings(id, {});
    }
    
    res.json({ success: true, data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update property
router.put('/property/:id', (req: Request, res: Response) => {
  try {
    const { name, currency, timezone } = req.body;
    const property = database.updateProperty(req.params.id, {
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
router.get('/import/history/:propertyId', (req: Request, res: Response) => {
  try {
    const files = database.getImportFilesByProperty(req.params.propertyId, 20);
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Metrics Routes
// =====================================================

// Get home dashboard metrics (4 tiles)
router.get('/metrics/:propertyId', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = calculateHomeMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      metrics = calculateHomeMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Command Center - All key metrics unified (responds to 40 key questions)
router.get('/metrics/:propertyId/command-center', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = getCommandCenterData(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = getCommandCenterData(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cash view metrics (runway, daily flow, alerts)
router.get('/metrics/:propertyId/cash', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = calculateCashMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      metrics = calculateCashMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get channel metrics (donut, dependency, savings)
router.get('/metrics/:propertyId/channels', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let metrics;
    
    if (startDate && endDate) {
      metrics = calculateChannelMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      metrics = calculateChannelMetrics(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collections data (reservations with balance due)
router.get('/metrics/:propertyId/collections', (req: Request, res: Response) => {
  try {
    const data = getCollectionsData(req.params.propertyId);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get daily flow for chart
router.get('/metrics/:propertyId/daily-flow', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = database.getDailyFlow(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      const end = new Date().toISOString().substring(0, 10);
      const start = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      data = database.getDailyFlow(req.params.propertyId, start, end);
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get revenue projection (future bookings)
router.get('/metrics/:propertyId/projection', (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const data = calculateRevenueProjection(req.params.propertyId, weeks);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get period comparison (this month vs previous)
router.get('/metrics/:propertyId/comparison', (req: Request, res: Response) => {
  try {
    const data = calculateMoMComparison(req.params.propertyId);
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get structure metrics (Occupancy, ADR, RevPAR, GOPPAR)
router.get('/metrics/:propertyId/structure', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = calculateStructureMetrics(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = calculateStructureMetrics(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get reconciliation metrics (Charged vs Collected)
router.get('/metrics/:propertyId/reconcile', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = calculateReconciliation(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = calculateReconciliation(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get A/R aging
router.get('/metrics/:propertyId/ar-aging', (req: Request, res: Response) => {
  try {
    const data = getARAging(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get break-even metrics
router.get('/metrics/:propertyId/breakeven', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = getBreakEvenAnalysis(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = getBreakEvenAnalysis(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get minimum price simulation
router.get('/metrics/:propertyId/minimum-price', (req: Request, res: Response) => {
  try {
    const margin = parseFloat(req.query.margin as string) || 0;
    const data = getMinimumPriceSimulation(req.params.propertyId, margin);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get intelligent insights
router.get('/metrics/:propertyId/insights', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let insights;
    
    if (startDate && endDate) {
      insights = generateInsights(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      insights = generateInsights(req.params.propertyId, d);
    }
    
    res.json({ success: true, data: insights });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get trends
router.get('/metrics/:propertyId/trends', (req: Request, res: Response) => {
  try {
    const { months } = req.query;
    const data = calculateTrendMetrics(req.params.propertyId, parseInt(months as string) || 6);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get DOW performance
router.get('/metrics/:propertyId/dow', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = calculateDOWPerformance(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 90;
      data = calculateDOWPerformance(req.params.propertyId, d);
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get YoY comparison
router.get('/metrics/:propertyId/yoy', (req: Request, res: Response) => {
  try {
    const data = calculateYoYComparison(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Reservation Economics Routes (P&L por reserva)
// =====================================================

// Get reservation economics summary (aggregates + patterns + worst)
router.get('/metrics/:propertyId/reservation-economics', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    let data;
    
    if (startDate && endDate) {
      data = calculateReservationEconomicsSummary(req.params.propertyId, startDate as string, endDate as string);
    } else {
      const d = parseInt(days as string) || 30;
      data = calculateReservationEconomicsSummary(req.params.propertyId, d);
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all reservation economics (full list with filters)
router.get('/metrics/:propertyId/reservation-economics/list', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days, source, nightsBucket, unprofitableOnly } = req.query;
    const filters = {
      source: source as string | undefined,
      nightsBucket: nightsBucket as '1' | '2' | '3+' | undefined,
      unprofitableOnly: unprofitableOnly === 'true',
    };
    
    let data;
    if (startDate && endDate) {
      data = getReservationEconomicsList(req.params.propertyId, startDate as string, endDate as string, filters);
    } else {
      const d = parseInt(days as string) || 30;
      data = getReservationEconomicsList(req.params.propertyId, d, filters);
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single reservation economics detail
router.get('/metrics/:propertyId/reservation-economics/:reservationNumber', (req: Request, res: Response) => {
  try {
    const data = getReservationEconomicsDetail(
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
router.get('/metrics/:propertyId/unprofitable', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = getReservationEconomicsList(req.params.propertyId, days, { unprofitableOnly: true });
    
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Actions Routes
// =====================================================

// Get recommended actions
router.get('/actions/:propertyId', (req: Request, res: Response) => {
  try {
    const actions = generateActions(req.params.propertyId);
    const completed = getCompletedSteps(req.params.propertyId);
    
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
router.post('/actions/:propertyId/step', (req: Request, res: Response) => {
  try {
    const { actionType, stepIndex } = req.body;
    completeActionStep(req.params.propertyId, actionType, stepIndex);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Cost Settings Routes (V3 - Simplified Zero Friction)
// =====================================================

// Get channels from PMS data (for commission configuration)
router.get('/costs/:propertyId/channels', (req: Request, res: Response) => {
  try {
    const channels = database.getChannelsFromPMS(req.params.propertyId);
    res.json({ success: true, data: channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cost settings with occupancy data for auto-calculations
router.get('/costs/:propertyId', (req: Request, res: Response) => {
  try {
    let costs = database.getCostSettings(req.params.propertyId);
    
    if (!costs) {
      costs = database.upsertCostSettings(req.params.propertyId, {});
    }
    
    // Get occupancy stats from PMS data
    const occupancy = database.getOccupancyStats(req.params.propertyId, 30);
    
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
router.put('/costs/:propertyId', (req: Request, res: Response) => {
  try {
    const {
      roomCount,
      startingCashBalance,
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
      const cleaningCat = variableCategories.find((c: any) => c.id === 'cleaning' || c.name.toLowerCase().includes('limpieza'));
      const laundryCat = variableCategories.find((c: any) => c.id === 'laundry' || c.name.toLowerCase().includes('lavandería'));
      const amenitiesCat = variableCategories.find((c: any) => c.id === 'amenities' || c.name.toLowerCase().includes('amenities'));
      
      // Store legacy format too
      updateData.variable_costs = {
        cleaningPerStay: cleaningCat?.monthlyAmount || 0, // Note: this is total, not per stay
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
        salaries: fixedCosts.salaries ?? fixedCosts.salpiaries,
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
    
    const costs = database.upsertCostSettings(req.params.propertyId, updateData);
    
    cacheService.clear();
    res.json({ success: true, data: costs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Data Health Route
// =====================================================

router.get('/data-health/:propertyId', (req: Request, res: Response) => {
  try {
    const health = database.getDataHealth(req.params.propertyId);
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Telemetry Routes
// =====================================================

// Log event
router.post('/telemetry', (req: Request, res: Response) => {
  try {
    const { propertyId, eventType, eventData } = req.body;
    
    database.insertLog({
      id: nanoid(),
      property_id: propertyId,
      event_type: eventType,
      event_data: JSON.stringify(eventData || {}),
      created_at: new Date().toISOString(),
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
