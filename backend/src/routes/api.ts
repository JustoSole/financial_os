import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import database, { setAuthContext, clearAuthContext } from '../db';
import { supabase, isSupabaseConfigured } from '../db/supabase-client';
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
import { ProjectionsService } from '../services/projections-service';
import { generateActions, completeActionStep, getCompletedSteps } from '../services/actions-service';
import { generateInsights } from '../services/insights-service';
import {
  calculateReservationEconomicsSummary,
  getReservationEconomicsList,
  getReservationEconomicsDetail,
} from '../services/reservation-economics-service';
import { getCommandCenterData, getBreakEvenAnalysis } from '../services/command-center-service';
import { calculateTrendMetrics } from '../services/trends-service';
import { CalculationEngine } from '../services/calculation-engine';
import { backfillReservationDailySnapshots } from '../services/snapshot-backfill-service';
import { reconstructReservationSnapshotAsOf } from '../services/snapshot-reconstruction-service';
import {
  openMonthlyPeriod,
  closeMonthlyPeriod,
  reopenMonthlyPeriod,
  getMonthlyCloseDetail,
  calculateMonthlyChecks,
  calculateConfidenceScore,
} from '../services/monthly-close-service';
import { getConfidenceBand } from '@financial-os/shared';

const router = Router();

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
function validateMonth(month: string): boolean {
  return MONTH_REGEX.test(month);
}

// Auth cache: avoids hitting Supabase auth API on every request
const _authCache = new Map<string, { user: any; expiresAt: number }>();
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 min

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    const cached = _authCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      (req as any).user = cached.user;
      (req as any).accessToken = token;
      setAuthContext(token);
      res.on('finish', () => clearAuthContext());
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      _authCache.delete(token);
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    _authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL });

    (req as any).user = user;
    (req as any).accessToken = token;
    setAuthContext(token);
    res.on('finish', () => clearAuthContext());
    
    next();
  } catch (error: any) {
    clearAuthContext();
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

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
// Public Routes (no auth required)
// =====================================================
router.get('/health', (req: Request, res: Response) => {
  const supabaseStatus = isSupabaseConfigured();
  res.json({ 
    success: true, 
    status: supabaseStatus ? 'ok' : 'degraded', 
    timestamp: new Date().toISOString(),
    service: 'financial-os-backend',
    dependencies: {
      supabase: supabaseStatus ? 'configured' : 'missing_credentials'
    },
    ...(supabaseStatus ? {} : {
      warning: 'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    })
  });
});

// Validate CSV without importing (no requiere autenticación ya que no escribe)
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

// =====================================================
// Protected Routes (auth required)
// =====================================================
router.use(authenticate);

// Property Routes
router.get('/property', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log(`📋 GET /api/property - User: ${user.email}`);
    
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
      
      await database.upsertCostSettings(id, {});
      console.log('📋 Default cost settings created');
    }
    
    res.json({ success: true, data: property });
  } catch (error: any) {
    console.error('❌ Error in /api/property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// Import Routes
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
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
      try {
        const result = await importCSV(propertyId, file.originalname, content);
        results.push({ filename: file.originalname, ...result });
      } catch (err: any) {
        results.push({ filename: file.originalname, success: false, error: err.message });
      }
    }
    const allSuccess = results.every(r => r.success);
    res.json({ 
      success: allSuccess, 
      data: { results },
      message: allSuccess ? 'Todos los archivos procesados correctamente' : 'Algunos archivos tuvieron errores',
      error: allSuccess ? undefined : results.find(r => !r.success)?.error
    });
  } catch (error: any) {
    console.error('❌ Error in /api/import/batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/import/history/:propertyId', async (req: Request, res: Response) => {
  try {
    const files = await database.getImportFilesByProperty(req.params.propertyId, 20);
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Metrics Routes
router.get('/metrics/:propertyId', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    const metrics = await calculateHomeMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 30), endDate as string);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error in /metrics/:propertyId/command-center:', error);
    res.status(500).json({ success: false, error: 'Error interno al procesar el Command Center', message: error.message });
  }
});

router.get('/metrics/:propertyId/cash', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    const metrics = await calculateCashMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 90), endDate as string);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/channels', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    const metrics = await calculateChannelMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 90), endDate as string);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/collections', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days } = req.query;
    const data = await getCollectionsData(req.params.propertyId, startDate as string || (parseInt(days as string) || 30), endDate as string);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/metrics/:propertyId/projection', async (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const data = await calculateRevenueProjection(req.params.propertyId, weeks);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/comparison', async (req: Request, res: Response) => {
  try {
    const data = await calculateMoMComparison(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/metrics/:propertyId/ar-aging', async (req: Request, res: Response) => {
  try {
    const data = await getARAging(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/metrics/:propertyId/minimum-price', async (req: Request, res: Response) => {
  try {
    const margin = parseFloat(req.query.margin as string) || 0;
    const data = await getMinimumPriceSimulation(req.params.propertyId, margin);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/metrics/:propertyId/trends', async (req: Request, res: Response) => {
  try {
    const { months } = req.query;
    const data = await calculateTrendMetrics(req.params.propertyId, parseInt(months as string) || 6);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

router.get('/metrics/:propertyId/yoy', async (req: Request, res: Response) => {
  try {
    const data = await calculateYoYComparison(req.params.propertyId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/projections', async (req: Request, res: Response) => {
  try {
    const horizon = parseInt(req.query.horizon as string) || 90;
    const service = new ProjectionsService(req.params.propertyId, horizon);
    const data = await service.getProjections();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reservation Economics Routes
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
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/reservation-economics/list', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, days, source, unprofitableOnly } = req.query;
    const filters: any = {};
    if (source) filters.source = source as string;
    if (unprofitableOnly === 'true') filters.unprofitableOnly = true;
    
    let data;
    if (startDate && endDate) {
      data = await getReservationEconomicsList(req.params.propertyId, startDate as string, endDate as string, filters);
    } else {
      const d = parseInt(days as string) || 30;
      data = await getReservationEconomicsList(req.params.propertyId, d, filters);
    }
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/reservation-economics/:reservationNumber', async (req: Request, res: Response) => {
  try {
    const data = await getReservationEconomicsDetail(req.params.propertyId, req.params.reservationNumber);
    if (!data) return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/:propertyId/unprofitable', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const d = parseInt(days as string) || 30;
    const data = await getReservationEconomicsList(req.params.propertyId, d, { unprofitableOnly: true } as any);
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actions Routes
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
    // Apply legacy completed steps and whole-action status to backend-generated actions
    for (const action of actions) {
      const actionId = action.id || action.type;
      if (completed.byActionType[action.type]) {
        for (let i = 0; i < (action.steps || []).length; i++) {
          if (completed.byActionType[action.type].includes(i)) action.steps[i].completed = true;
        }
      }
      if (completed.actionStatus && completed.actionStatus[actionId]) {
        action.status = completed.actionStatus[actionId].status;
        action.completedAt = completed.actionStatus[actionId].completedAt;
      } else {
        action.status = 'pending';
      }
    }
    res.json({ success: true, data: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all completed steps (for frontend-generated actions)
router.get('/actions/:propertyId/completed', async (req: Request, res: Response) => {
  try {
    const { daysBack } = req.query;
    const days = parseInt(daysBack as string) || 90;
    const completed = await getCompletedSteps(req.params.propertyId, days);
    res.json({ success: true, data: completed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/actions/:propertyId/step', async (req: Request, res: Response) => {
  try {
    const { actionType, stepIndex, actionId, stepId } = req.body;
    // Support both legacy (actionType + stepIndex) and new (actionId + stepId) formats
    if (actionId && stepId) {
      await completeActionStep(req.params.propertyId, actionId, stepId);
    } else if (actionType !== undefined && stepIndex !== undefined) {
      await completeActionStep(req.params.propertyId, actionType, stepIndex);
    } else {
      return res.status(400).json({ success: false, error: 'Missing actionId/stepId or actionType/stepIndex' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set whole-action status (done | dismissed)
router.post('/actions/:propertyId/status', async (req: Request, res: Response) => {
  try {
    const { actionId, status } = req.body;
    if (!actionId || !status || !['done', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid actionId/status (use done or dismissed)' });
    }
    await completeActionStep(req.params.propertyId, actionId, status);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Meta Routes
// Cost Settings Routes
router.get('/costs/:propertyId/channels', async (req: Request, res: Response) => {
  try {
    const channels = await database.getChannelsFromPMS(req.params.propertyId);
    res.json({ success: true, data: channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/costs/:propertyId', async (req: Request, res: Response) => {
  try {
    let costs = await database.getCostSettings(req.params.propertyId);
    if (!costs) costs = await database.upsertCostSettings(req.params.propertyId, {});

    // Auto-seed default IVA 21% if no tax rules configured
    if (!costs.tax_rules || costs.tax_rules.length === 0) {
      const defaultTaxRules = [
        { id: 'iva', name: 'IVA', type: 'VAT', appliesTo: 'room_rate', method: 'percentage', value: 21, includedInRate: true },
      ];
      costs = await database.upsertCostSettings(req.params.propertyId, { tax_rules: defaultTaxRules });
    }

    const occupancy = await database.getOccupancyStats(req.params.propertyId, 30);
    let totalVariableMonthly = 0;
    let totalFixedMonthly = 0;
    if (costs.variable_categories && costs.variable_categories.length > 0) {
      totalVariableMonthly = costs.variable_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    } else if (costs.variable_costs) {
      totalVariableMonthly = (costs.variable_costs.cleaningPerStay || 0) + (costs.variable_costs.laundryMonthly || 0) + (costs.variable_costs.amenitiesMonthly || 0);
    }
    if (costs.fixed_categories && costs.fixed_categories.length > 0) {
      totalFixedMonthly = costs.fixed_categories.reduce((sum: number, cat: any) => sum + (cat.monthlyAmount || 0), 0);
    } else if (costs.fixed_costs) {
      totalFixedMonthly = (costs.fixed_costs.salaries || 0) + (costs.fixed_costs.rent || 0) + (costs.fixed_costs.utilities || 0) + (costs.fixed_costs.other || 0);
    }
    const variablePerNight = occupancy.occupiedNights > 0 ? totalVariableMonthly / occupancy.occupiedNights : 0;
    const fixedPerDay = totalFixedMonthly / 30.44;
    res.json({ 
      success: true, 
      data: {
        ...costs,
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

router.put('/costs/:propertyId', async (req: Request, res: Response) => {
  try {
    const {
      roomCount, startingCashBalance, cleaningPerStay,
      variableCategories, fixedCategories, extraordinaryCosts,
      variableCosts, fixedCosts, channelCommissions, paymentFees,
      tax_rules,
    } = req.body;
    const updateData: any = {};
    if (roomCount !== undefined) updateData.room_count = roomCount;
    if (startingCashBalance !== undefined) updateData.starting_cash_balance = startingCashBalance;
    if (variableCategories) {
      updateData.variable_categories = variableCategories;
      const laundryCat = variableCategories.find((c: any) => c.id === 'laundry' || c.name.toLowerCase().includes('lavandería'));
      const amenitiesCat = variableCategories.find((c: any) => c.id === 'amenities' || c.name.toLowerCase().includes('amenities'));
      updateData.variable_costs = {
        cleaningPerStay: cleaningPerStay !== undefined ? cleaningPerStay : 0,
        laundryMonthly: laundryCat?.monthlyAmount || 0,
        amenitiesMonthly: amenitiesCat?.monthlyAmount || 0,
      };
    } else if (variableCosts) {
      updateData.variable_costs = {
        cleaningPerStay: variableCosts.cleaningPerStay,
        laundryMonthly: variableCosts.laundryMonthly,
        amenitiesMonthly: variableCosts.amenitiesMonthly,
      };
    } else if (cleaningPerStay !== undefined) {
      const existingCosts = await database.getCostSettings(req.params.propertyId);
      updateData.variable_costs = { ...existingCosts?.variable_costs, cleaningPerStay };
    }
    if (fixedCategories) {
      updateData.fixed_categories = fixedCategories;
      const salariesCat = fixedCategories.find((c: any) => c.id === 'salaries' || c.name.toLowerCase().includes('sueldo'));
      const rentCat = fixedCategories.find((c: any) => c.id === 'rent' || c.name.toLowerCase().includes('alquiler'));
      const utilitiesCat = fixedCategories.find((c: any) => c.id === 'utilities' || c.name.toLowerCase().includes('servicio'));
      const otherTotal = fixedCategories
        .filter((c: any) => !['salaries', 'rent', 'utilities'].includes(c.id) && !c.name.toLowerCase().includes('sueldo') && !c.name.toLowerCase().includes('alquiler') && !c.name.toLowerCase().includes('servicio'))
        .reduce((sum: number, c: any) => sum + (c.monthlyAmount || 0), 0);
      updateData.fixed_costs = { salaries: salariesCat?.monthlyAmount || 0, rent: rentCat?.monthlyAmount || 0, utilities: utilitiesCat?.monthlyAmount || 0, other: otherTotal };
    } else if (fixedCosts) {
      updateData.fixed_costs = { salaries: fixedCosts.salaries, rent: fixedCosts.rent, utilities: fixedCosts.utilities, other: fixedCosts.other };
    }
    if (channelCommissions) updateData.channel_commissions = { defaultRate: channelCommissions.defaultRate, byChannel: channelCommissions.byChannel };
    if (paymentFees) updateData.payment_fees = { enabled: paymentFees.enabled, defaultRate: paymentFees.defaultRate, byMethod: paymentFees.byMethod };
    if (extraordinaryCosts !== undefined) updateData.extraordinary_costs = extraordinaryCosts;
    if (tax_rules !== undefined) updateData.tax_rules = tax_rules;
    const costs = await database.upsertCostSettings(req.params.propertyId, updateData);
    cacheService.clear();
    res.json({ success: true, data: costs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Monthly Close Routes
// =====================================================

router.get('/close/:propertyId/periods', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 12;
    const periods = await database.listMonthlyPeriods(req.params.propertyId, limit);
    const data = periods.map((p: any) => ({
      month: p.month,
      status: p.status,
      confidenceScore: Number(p.confidence_score),
      confidenceBand: getConfidenceBand(Number(p.confidence_score)),
      closedAt: p.closed_at,
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/close/:propertyId/period/:month', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const detail = await getMonthlyCloseDetail(propertyId, month);
    res.json({ success: true, data: detail });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/close/:propertyId/period/:month/checks', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const checks = await calculateMonthlyChecks(propertyId, month);
    const score = calculateConfidenceScore(checks);
    res.json({ success: true, data: { checks, score, band: getConfidenceBand(score) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/close/:propertyId/period/:month/open', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const period = await openMonthlyPeriod(propertyId, month);
    res.json({ success: true, data: period });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/close/:propertyId/period/:month/close', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const user = (req as any).user;
    const result = await closeMonthlyPeriod(propertyId, month, user?.id);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error, data: { checks: result.checks } });
    }
    cacheService.clear();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/close/:propertyId/period/:month/reopen', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const user = (req as any).user;
    const result = await reopenMonthlyPeriod(propertyId, month, user?.id);
    cacheService.clear();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Monthly Costs Routes (by month)
// =====================================================

router.get('/costs/:propertyId/categories', async (req: Request, res: Response) => {
  try {
    const categories = await database.getCostCategories();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/costs/:propertyId/monthly/:month', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const entries = await database.getMonthlyCosts(propertyId, month);
    const cashBalance = await database.getMonthlyCashBalance(propertyId, month);
    const categories = await database.getCostCategories();
    
    const costsByCategory = entries.map((e: any) => ({
      id: e.id,
      categoryKey: e.category_key,
      displayName: e.cost_categories?.display_name || e.category_key,
      costType: e.cost_type,
      amount: Number(e.amount),
      source: e.source,
      note: e.note,
    }));

    res.json({
      success: true,
      data: {
        month,
        entries: costsByCategory,
        cashBalance: cashBalance ? Number(cashBalance.balance) : null,
        categories: categories.map((c: any) => ({
          categoryKey: c.category_key,
          displayName: c.display_name,
          costTypeDefault: c.cost_type_default,
          sortOrder: c.sort_order,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/costs/:propertyId/monthly/:month', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const { entries, cashBalance } = req.body;

    const period = await database.getOrCreateMonthlyPeriod(propertyId, month);
    if (period.status === 'closed' || period.status === 'closed_with_warnings') {
      return res.status(409).json({
        success: false,
        error: `El período ${month} está cerrado. Reabrilo antes de editar.`,
      });
    }

    if (entries && entries.length > 0) {
      const dbEntries = entries.map((e: any) => ({
        category_key: e.categoryKey,
        cost_type: e.costType,
        amount: e.amount,
        source: e.source || 'manual',
        note: e.note || null,
      }));
      await database.upsertMonthlyCosts(propertyId, month, dbEntries);
    }

    if (cashBalance !== undefined && cashBalance !== null) {
      await database.upsertMonthlyCashBalance(propertyId, month, cashBalance);
    }

    cacheService.clear();

    const updated = await database.getMonthlyCosts(propertyId, month);
    const updatedCash = await database.getMonthlyCashBalance(propertyId, month);

    res.json({
      success: true,
      data: {
        month,
        entries: updated.map((e: any) => ({
          categoryKey: e.category_key,
          displayName: e.cost_categories?.display_name || e.category_key,
          costType: e.cost_type,
          amount: Number(e.amount),
          source: e.source,
        })),
        cashBalance: updatedCash ? Number(updatedCash.balance) : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Copy costs from previous month
router.post('/costs/:propertyId/monthly/:month/copy-previous', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevCosts = await database.getMonthlyCosts(propertyId, prevMonth);
    if (prevCosts.length === 0) {
      return res.status(404).json({ success: false, error: `No hay costos en ${prevMonth}` });
    }

    const period = await database.getOrCreateMonthlyPeriod(propertyId, month);
    if (period.status === 'closed' || period.status === 'closed_with_warnings') {
      return res.status(409).json({
        success: false,
        error: `El período ${month} está cerrado. Reabrilo antes de editar.`,
      });
    }

    const entries = prevCosts.map((e: any) => ({
      category_key: e.category_key,
      cost_type: e.cost_type,
      amount: Number(e.amount),
      source: 'manual',
      note: `Copiado de ${prevMonth}`,
    }));

    await database.upsertMonthlyCosts(propertyId, month, entries);
    cacheService.clear();

    const updated = await database.getMonthlyCosts(propertyId, month);
    res.json({
      success: true,
      data: updated.map((e: any) => ({
        categoryKey: e.category_key,
        displayName: e.cost_categories?.display_name || e.category_key,
        costType: e.cost_type,
        amount: Number(e.amount),
        source: e.source,
      })),
      message: `${entries.length} costos copiados de ${prevMonth}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import Jobs Route
router.get('/import/jobs/:propertyId', async (req: Request, res: Response) => {
  try {
    const { month } = req.query;
    const jobs = await database.listImportJobs(req.params.propertyId, {
      month: month as string,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json({ success: true, data: jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Data Health Route
router.get('/data-health/:propertyId', async (req: Request, res: Response) => {
  try {
    const engine = new CalculationEngine(req.params.propertyId, { 
      start: new Date().toISOString().substring(0, 10), 
      end: new Date().toISOString().substring(0, 10), 
      days: 30 
    });
    await engine.init();
    const health = engine.getDataHealth();
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telemetry Route
router.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const { propertyId, eventType, eventData } = req.body;
    try {
      await database.insertLog({
        id: uuidv4(),
        property_id: propertyId,
        event_type: eventType,
        event_data: JSON.stringify(eventData || {}),
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.warn('⚠️ Telemetry log failed (table might not exist or RLS):', dbError);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RESET DATABASE Route
router.post('/property/:propertyId/reset', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const user = (req as any).user;
    const property = await database.getPropertyById(propertyId);
    if (!property || property.user_id !== user.id) return res.status(403).json({ success: false, error: 'Unauthorized' });
    await database.resetDatabase(propertyId);
    cacheService.clear();
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Backfill reservation daily snapshots for exact historical pacing
router.post('/admin/:propertyId/backfill-snapshots', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const user = (req as any).user;
    const limit = Number.isFinite(Number(req.body?.limit)) ? Number(req.body.limit) : 5000;
    const dryRun = Boolean(req.body?.dryRun);

    const property = await database.getPropertyById(propertyId);
    if (!property || property.user_id !== user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const result = await backfillReservationDailySnapshots(propertyId, { limit, dryRun });
    cacheService.clear();
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Reconstruct a specific as-of snapshot date (operational fallback when historical import snapshot is missing)
router.post('/admin/:propertyId/reconstruct-snapshot-asof', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const user = (req as any).user;
    const snapshotDate = String(req.body?.snapshotDate || '').substring(0, 10);
    const dryRun = Boolean(req.body?.dryRun);

    if (!snapshotDate) {
      return res.status(400).json({ success: false, error: 'snapshotDate is required (YYYY-MM-DD)' });
    }

    const property = await database.getPropertyById(propertyId);
    if (!property || property.user_id !== user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const result = await reconstructReservationSnapshotAsOf(propertyId, { snapshotDate, dryRun });
    cacheService.clear();
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
