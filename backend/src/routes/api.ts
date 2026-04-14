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
import { DAYS_PER_MONTH } from '../types';
import logger from '../services/logger';
import { z } from 'zod';

// --- Input validation schemas ---
const propertyUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().min(1).max(50).optional(),
}).strict();

const adminCreateUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Password debe tener al menos 8 caracteres'),
  hotelName: z.string().max(100).optional(),
  expiresAt: z.string().optional().nullable(),
});

const costSettingsSchema = z.object({
  roomCount: z.number().int().min(1).max(9999).optional(),
  startingCashBalance: z.number().min(0).optional(),
  cleaningPerStay: z.number().min(0).optional(),
  variableCategories: z.array(z.any()).optional(),
  fixedCategories: z.array(z.any()).optional(),
  extraordinaryCosts: z.array(z.any()).optional(),
  variableCosts: z.any().optional(),
  fixedCosts: z.any().optional(),
  channelCommissions: z.any().optional(),
  paymentFees: z.any().optional(),
  tax_rules: z.array(z.any()).optional(),
}).passthrough();
import { backfillReservationDailySnapshots } from '../services/snapshot-backfill-service';
import { reconstructReservationSnapshotAsOf } from '../services/snapshot-reconstruction-service';
const router = Router();

/**
 * Route-level cache: wraps a handler so repeated identical GETs return cached JSON.
 * Cache key = URL path + querystring, so different params are cached separately.
 */
function cached(handler: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    const key = `route:${req.originalUrl}`;
    const hit = cacheService.get<any>(key);
    if (hit) {
      res.set('X-Cache', 'HIT');
      return res.json(hit);
    }
    try {
      const result = await handler(req, res);
      if (result && !res.headersSent) {
        const body = { success: true, data: result };
        cacheService.set(key, body);
        res.set('X-Cache', 'MISS');
        res.json(body);
      }
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: safeError(error) });
      }
    }
  };
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
function validateMonth(month: string): boolean {
  return MONTH_REGEX.test(month);
}

/** Sanitize error messages before sending to client */
function safeError(error: any): string {
  if (process.env.NODE_ENV !== 'production') return error?.message || 'Error desconocido';
  const msg = error?.message || '';
  // Allow known user-facing errors through
  if (msg.includes('propertyId') || msg.includes('CSV') || msg.includes('requerido') || msg.includes('Falta')) {
    return msg;
  }
  return 'Error interno del servidor';
}

// Auth cache: avoids hitting Supabase auth API on every request
const _authCache = new Map<string, { user: any; expiresAt: number }>();
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 min

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Subscription cache: avoid checking expiry on every request
const _subscriptionCache = new Map<string, { ok: boolean; expiresAt: number }>();
const SUB_CACHE_TTL = 2 * 60 * 1000; // 2 min

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

const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'No user' });

    // Admins bypass subscription check
    if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) return next();

    const cacheKey = `sub-${user.id}`;
    const cached = _subscriptionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      if (!cached.ok) return res.status(403).json({ success: false, error: 'subscription_expired' });
      return next();
    }

    const property = await database.getPropertyByUser(user.id);
    if (!property) return next(); // no property yet, let them create one

    const isExpired = property.expires_at && new Date(property.expires_at) < new Date();
    const isInactive = property.is_active === false;
    const ok = !isExpired && !isInactive;

    _subscriptionCache.set(cacheKey, { ok, expiresAt: Date.now() + SUB_CACHE_TTL });

    if (!ok) return res.status(403).json({ success: false, error: 'subscription_expired' });
    next();
  } catch {
    next();
  }
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
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
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// =====================================================
// Protected Routes (auth required)
// =====================================================
router.use(authenticate);

// Admin routes (before subscription check so admins can always access)
router.get('/admin/check', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, data: { isAdmin: true } });
});

router.get('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) return res.status(500).json({ success: false, error: safeError(error) });

    const users = (data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      propertyId: u.property_id,
      propertyName: u.property_name,
      expires_at: u.expires_at,
      is_active: u.is_active ?? true,
    }));
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.post('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }
    const { email, password, hotelName, expiresAt } = parsed.data;

    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: email,
      p_password: password,
      p_hotel_name: hotelName || 'Mi Hotel',
      p_expires_at: expiresAt || null,
    });
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.put('/admin/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { expiresAt, isActive, hotelName } = req.body;

    const { error } = await supabase.rpc('admin_update_user', {
      p_user_id: req.params.userId,
      p_expires_at: expiresAt !== undefined ? expiresAt : null,
      p_is_active: isActive !== undefined ? isActive : null,
      p_hotel_name: hotelName !== undefined ? hotelName : null,
    });
    if (error) return res.status(500).json({ success: false, error: safeError(error) });

    _subscriptionCache.delete(`sub-${req.params.userId}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.delete('/admin/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: req.params.userId,
    });
    if (error) return res.status(500).json({ success: false, error: safeError(error) });

    _subscriptionCache.delete(`sub-${req.params.userId}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// Subscription check (after admin routes, so admins bypass it)
router.use(checkSubscription);

// Property ownership cache: avoids DB lookup on every request
const _ownershipCache = new Map<string, { valid: boolean; expiresAt: number }>();
const OWNERSHIP_CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Validates that the authenticated user owns the property referenced by :propertyId.
 * Uses router.param() so it runs automatically for ALL routes with :propertyId.
 * Admins bypass this check.
 */
router.param('propertyId', async (req: Request, res: Response, next: NextFunction, propertyId: string) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'No user' });

    // Admins can access any property
    if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) return next();

    const cacheKey = `own-${user.id}-${propertyId}`;
    const cached = _ownershipCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      if (!cached.valid) return res.status(403).json({ success: false, error: 'No tienes acceso a esta propiedad' });
      return next();
    }

    const property = await database.getPropertyByUser(user.id);
    const valid = !!property && property.id === propertyId;

    _ownershipCache.set(cacheKey, { valid, expiresAt: Date.now() + OWNERSHIP_CACHE_TTL });

    if (!valid) return res.status(403).json({ success: false, error: 'No tienes acceso a esta propiedad' });
    next();
  } catch (error) {
    // Fail CLOSED: deny access on error (never fail open on auth checks)
    logger.error('api', 'Error validating property ownership', error);
    return res.status(500).json({ success: false, error: 'Error verificando acceso' });
  }
});

// Property Routes
router.get('/property', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    logger.debug('api', `GET /api/property - User: ${user.email}`);

    let property = await database.getPropertyByUser(user.id);

    if (!property) {
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
      logger.debug('api', `Default property created: ${id}`);

      await database.upsertCostSettings(id, {});
    }
    
    res.json({ success: true, data: property });
  } catch (error: any) {
    logger.error('api', 'Error in /api/property', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.put('/property/:id', async (req: Request, res: Response) => {
  try {
    const parsed = propertyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }
    const { name, currency, timezone } = parsed.data;
    const property = await database.updateProperty(req.params.id, {
      name,
      currency,
      timezone,
      updated_at: new Date().toISOString(),
    });
    
    cacheService.clear();
    res.json({ success: true, data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
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
    // Validate ownership for body-based propertyId
    const user = (req as any).user;
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      const prop = await database.getPropertyByUser(user.id);
      if (!prop || prop.id !== propertyId) {
        return res.status(403).json({ success: false, error: 'No tienes acceso a esta propiedad' });
      }
    }
    const content = req.file.buffer.toString('utf-8');
    const result = await importCSV(propertyId, req.file.originalname, content);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
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
    // Validate ownership for body-based propertyId
    const user = (req as any).user;
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      const prop = await database.getPropertyByUser(user.id);
      if (!prop || prop.id !== propertyId) {
        return res.status(403).json({ success: false, error: 'No tienes acceso a esta propiedad' });
      }
    }
    const results = [];
    for (const file of files) {
      const content = file.buffer.toString('utf-8');
      try {
        const result = await importCSV(propertyId, file.originalname, content);
        results.push({ filename: file.originalname, ...result });
      } catch (err: any) {
        results.push({ filename: file.originalname, success: false, error: safeError(err) });
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
    logger.error('api', 'Error in /api/import/batch', error);
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.get('/import/history/:propertyId', async (req: Request, res: Response) => {
  try {
    const files = await database.getImportFilesByProperty(req.params.propertyId, 20);
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// Metrics Routes (cached for performance)
router.get('/metrics/:propertyId', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  return calculateHomeMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 30), endDate as string);
}));

router.get('/metrics/:propertyId/command-center', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) {
    return getCommandCenterData(req.params.propertyId, startDate as string, endDate as string);
  }
  return getCommandCenterData(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/cash', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  return calculateCashMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 90), endDate as string);
}));

router.get('/metrics/:propertyId/channels', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  return calculateChannelMetrics(req.params.propertyId, startDate as string || (parseInt(days as string) || 90), endDate as string);
}));

router.get('/metrics/:propertyId/collections', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  return getCollectionsData(req.params.propertyId, startDate as string || (parseInt(days as string) || 30), endDate as string);
}));

router.get('/metrics/:propertyId/daily-flow', cached(async (req) => {
  const d = parseInt(req.query.days as string) || 30;
  return getDailyFlow(req.params.propertyId, d);
}));

router.get('/metrics/:propertyId/projection', cached(async (req) => {
  const weeks = parseInt(req.query.weeks as string) || 4;
  return calculateRevenueProjection(req.params.propertyId, weeks);
}));

router.get('/metrics/:propertyId/comparison', cached(async (req) => {
  return calculateMoMComparison(req.params.propertyId);
}));

router.get('/metrics/:propertyId/structure', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return calculateStructureMetrics(req.params.propertyId, startDate as string, endDate as string);
  return calculateStructureMetrics(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/reconcile', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return calculateReconciliation(req.params.propertyId, startDate as string, endDate as string);
  return calculateReconciliation(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/ar-aging', cached(async (req) => {
  return getARAging(req.params.propertyId);
}));

router.get('/metrics/:propertyId/breakeven', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return getBreakEvenAnalysis(req.params.propertyId, startDate as string, endDate as string);
  return getBreakEvenAnalysis(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/minimum-price', cached(async (req) => {
  const margin = parseFloat(req.query.margin as string) || 0;
  return getMinimumPriceSimulation(req.params.propertyId, margin);
}));

router.get('/metrics/:propertyId/insights', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return generateInsights(req.params.propertyId, startDate as string, endDate as string);
  return generateInsights(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/trends', cached(async (req) => {
  return calculateTrendMetrics(req.params.propertyId, parseInt(req.query.months as string) || 6);
}));

router.get('/metrics/:propertyId/dow', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return calculateDOWPerformance(req.params.propertyId, startDate as string, endDate as string);
  return calculateDOWPerformance(req.params.propertyId, parseInt(days as string) || 90);
}));

router.get('/metrics/:propertyId/yoy', cached(async (req) => {
  return calculateYoYComparison(req.params.propertyId);
}));

router.get('/metrics/:propertyId/projections', cached(async (req) => {
  const horizon = parseInt(req.query.horizon as string) || 90;
  const service = new ProjectionsService(req.params.propertyId, horizon);
  return service.getProjections();
}));

// Reservation Economics Routes
router.get('/metrics/:propertyId/reservation-economics', cached(async (req) => {
  const { startDate, endDate, days } = req.query;
  if (startDate && endDate) return calculateReservationEconomicsSummary(req.params.propertyId, startDate as string, endDate as string);
  return calculateReservationEconomicsSummary(req.params.propertyId, parseInt(days as string) || 30);
}));

router.get('/metrics/:propertyId/reservation-economics/list', cached(async (req) => {
  const { startDate, endDate, days, source, unprofitableOnly } = req.query;
  const filters: any = {};
  if (source) filters.source = source as string;
  if (unprofitableOnly === 'true') filters.unprofitableOnly = true;
  if (startDate && endDate) return getReservationEconomicsList(req.params.propertyId, startDate as string, endDate as string, filters);
  return getReservationEconomicsList(req.params.propertyId, parseInt(days as string) || 30, filters);
}));

router.get('/metrics/:propertyId/reservation-economics/:reservationNumber', async (req: Request, res: Response) => {
  try {
    const data = await getReservationEconomicsDetail(req.params.propertyId, req.params.reservationNumber);
    if (!data) return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.get('/metrics/:propertyId/unprofitable', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const d = parseInt(days as string) || 30;
    const data = await getReservationEconomicsList(req.params.propertyId, d, { unprofitableOnly: true } as any);
    res.json({ success: true, data: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
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
    for (const action of actions) {
      const actionId = action.id || action.type;
      // Legacy: step index completion
      if (completed.byActionType[action.type]) {
        for (let i = 0; i < (action.steps || []).length; i++) {
          if (completed.byActionType[action.type].includes(i)) action.steps[i].completed = true;
        }
      }
      // New: step id completion
      if (completed.byActionId[actionId]) {
        const completedStepIds = completed.byActionId[actionId];
        for (const step of action.steps || []) {
          if (step.id && completedStepIds.includes(step.id)) step.completed = true;
        }
      }
      if (completed.actionStatus?.[actionId]) {
        action.status = completed.actionStatus[actionId].status;
        action.completedAt = completed.actionStatus[actionId].completedAt;
      } else {
        action.status = 'pending';
      }
    }
    res.json({ success: true, data: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

// Meta Routes
// Cost Settings Routes
router.get('/costs/:propertyId/channels', async (req: Request, res: Response) => {
  try {
    const channels = await database.getChannelsFromPMS(req.params.propertyId);
    res.json({ success: true, data: channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: safeError(error) });
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
    const fixedPerDay = totalFixedMonthly / DAYS_PER_MONTH;
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
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.put('/costs/:propertyId', async (req: Request, res: Response) => {
  try {
    const parsed = costSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }
    const {
      roomCount, startingCashBalance, cleaningPerStay,
      variableCategories, fixedCategories, extraordinaryCosts,
      variableCosts, fixedCosts, channelCommissions, paymentFees,
      tax_rules,
    } = parsed.data;
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
  }
});

router.put('/costs/:propertyId/monthly/:month', async (req: Request, res: Response) => {
  try {
    const { propertyId, month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
    const { entries, cashBalance } = req.body;

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
    res.status(500).json({ success: false, error: safeError(error) });
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
      return res.status(404).json({
        success: false,
        error: `No hay costos cargados para ${prevMonth}. Cargá y guardá primero los costos de ese mes en Datos → Cargar costos.`,
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    res.status(500).json({ success: false, error: safeError(error) });
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
    return res.status(500).json({ success: false, error: safeError(error) });
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
    return res.status(500).json({ success: false, error: safeError(error) });
  }
});

export default router;
