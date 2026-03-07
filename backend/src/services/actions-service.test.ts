import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCompletedSteps, generateActions } from './actions-service';

const mockGetReservations = vi.fn();
const mockGetDataHealth = vi.fn();
const mockGetReservationEconomicsSummary = vi.fn();
const mockGetChannelMetrics = vi.fn();

vi.mock('../db', () => ({
  default: {
    getCompletedSteps: vi.fn(),
    insertActionCompletion: vi.fn(),
  },
}));

vi.mock('./calculation-engine', () => ({
  CalculationEngine: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getReservations: mockGetReservations,
    getDataHealth: mockGetDataHealth,
    getReservationEconomicsSummary: mockGetReservationEconomicsSummary,
    getChannelMetrics: mockGetChannelMetrics,
  })),
}));

vi.mock('./metrics-service', () => ({
  getCollectionsData: vi.fn(),
}));

import database from '../db';
import { getCollectionsData } from './metrics-service';

describe('actions-service getCompletedSteps', () => {
  beforeEach(() => {
    vi.mocked(database.getCompletedSteps).mockReset();
  });

  it('returns actionStatus for done/dismissed step_id', async () => {
    vi.mocked(database.getCompletedSteps).mockResolvedValue([
      { action_id: 'act-1', step_id: 'done', completed_at: '2025-02-01T12:00:00Z' },
      { action_id: 'act-2', step_id: 'dismissed', completed_at: '2025-02-02T12:00:00Z' },
    ]);

    const result = await getCompletedSteps('prop-1', 30);

    expect(result.actionStatus).toEqual({
      'act-1': { status: 'done', completedAt: '2025-02-01T12:00:00Z' },
      'act-2': { status: 'dismissed', completedAt: '2025-02-02T12:00:00Z' },
    });
    expect(result.byActionId).toEqual({});
  });

  it('returns byActionId for step completions (non done/dismissed)', async () => {
    vi.mocked(database.getCompletedSteps).mockResolvedValue([
      { action_id: 'act-1', step_id: 'step-1', completed_at: '2025-02-01T12:00:00Z' },
      { action_id: 'act-1', step_id: 'step-2', completed_at: '2025-02-01T12:01:00Z' },
    ]);

    const result = await getCompletedSteps('prop-1', 30);

    expect(result.byActionId).toEqual({ 'act-1': ['step-1', 'step-2'] });
    expect(result.actionStatus).toEqual({});
  });

  it('mixes step completions and whole-action status', async () => {
    vi.mocked(database.getCompletedSteps).mockResolvedValue([
      { action_id: 'act-1', step_id: 'step-1', completed_at: '2025-02-01T12:00:00Z' },
      { action_id: 'act-1', step_id: 'done', completed_at: '2025-02-01T13:00:00Z' },
    ]);

    const result = await getCompletedSteps('prop-1', 30);

    expect(result.byActionId).toEqual({ 'act-1': ['step-1'] });
    expect(result.actionStatus).toEqual({
      'act-1': { status: 'done', completedAt: '2025-02-01T13:00:00Z' },
    });
  });
});

describe('actions-service generateActions', () => {
  beforeEach(() => {
    vi.mocked(getCollectionsData).mockReset();
    mockGetReservations.mockReset();
    mockGetDataHealth.mockReset();
    mockGetReservationEconomicsSummary.mockReset();
    mockGetChannelMetrics.mockReset();

    mockGetDataHealth.mockReturnValue({ score: 90, issues: [] });
    mockGetReservations.mockReturnValue([]);
    vi.mocked(getCollectionsData).mockResolvedValue({ reservationsWithBalance: [] });
  });

  it('returns no_data action when no reservations in period', async () => {
    mockGetReservations.mockReturnValue([]);

    const actions = await generateActions('prop-1', 30);

    const noData = actions.find((a) => a.id === 'no-data');
    expect(noData).toBeDefined();
    expect(noData?.title).toContain('Sin datos en el período');
    expect(noData?.category).toBe('data');
  });

  it('returns data_health action when score < 80', async () => {
    mockGetDataHealth.mockReturnValue({ score: 50, issues: ['Falta reporte X', 'Falta reporte Y'] });
    mockGetReservations.mockReturnValue([]);

    const actions = await generateActions('prop-1', 30);

    const dataHealth = actions.find((a) => a.id === 'data-health');
    expect(dataHealth).toBeDefined();
    expect(dataHealth?.title).toBe('Mejorar Salud de Datos');
    expect(dataHealth?.steps).toHaveLength(2);
    expect(dataHealth?.steps?.map((s) => s.text)).toEqual(['Falta reporte X', 'Falta reporte Y']);
  });

  it('returns collection actions for overdue reservations with large balance', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const checkIn = pastDate.toISOString().slice(0, 10);

    mockGetReservations.mockReturnValue([{ id: 'r1' }]);
    mockGetDataHealth.mockReturnValue({ score: 90, issues: [] });
    mockGetReservationEconomicsSummary.mockReturnValue({
      patterns: [],
      worstReservations: [],
    });
    mockGetChannelMetrics.mockReturnValue({
      channels: [],
      savingsPotential: { value: 0 },
      insights: {},
    });
    vi.mocked(getCollectionsData).mockResolvedValue({
      reservationsWithBalance: [
        {
          reservationNumber: 'RES-001',
          guestName: 'Test Guest',
          checkIn,
          balanceDue: 15000,
          totalAmount: 20000,
          paidAmount: 5000,
        },
      ],
    });

    const actions = await generateActions('prop-1', 30);

    const collectAction = actions.find((a) => a.id === 'collect-RES-001');
    expect(collectAction).toBeDefined();
    expect(collectAction?.category).toBe('collections');
    expect(collectAction?.title).toContain('Verificar pago');
    expect(collectAction?.steps).toHaveLength(2);
    expect(collectAction?.impact.value).toBe(15000);
  });

  it('does not return collection action for small balance', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const checkIn = pastDate.toISOString().slice(0, 10);

    mockGetReservations.mockReturnValue([{ id: 'r1' }]);
    mockGetDataHealth.mockReturnValue({ score: 90, issues: [] });
    mockGetReservationEconomicsSummary.mockReturnValue({ patterns: [], worstReservations: [] });
    mockGetChannelMetrics.mockReturnValue({ channels: [], savingsPotential: { value: 0 }, insights: {} });
    vi.mocked(getCollectionsData).mockResolvedValue({
      reservationsWithBalance: [
        {
          reservationNumber: 'RES-002',
          guestName: 'Guest',
          checkIn,
          balanceDue: 5000,
          totalAmount: 10000,
          paidAmount: 5000,
        },
      ],
    });

    const actions = await generateActions('prop-1', 30);

    const collectAction = actions.find((a) => a.id === 'collect-RES-002');
    expect(collectAction).toBeUndefined();
  });

  it('returns channel optimization action when worst channel has high real cost', async () => {
    mockGetReservations.mockReturnValue([{ id: 'r1' }]);
    mockGetDataHealth.mockReturnValue({ score: 90, issues: [] });
    mockGetReservationEconomicsSummary.mockReturnValue({
      patterns: [],
      worstReservations: [],
    });
    // Worst by profitPerNight (lowest first) must have realCostPercent >= 18
    mockGetChannelMetrics.mockReturnValue({
      channels: [
        { source: 'Booking', sourceCategory: 'OTA', realCostPercent: 25, effectiveCommissionRate: 0.25, adr: 100, revenue: 50000, profitPerNight: 10 },
        { source: 'Direct', sourceCategory: 'Direct', realCostPercent: 0, adr: 120, revenue: 30000, profitPerNight: 80 },
      ],
      savingsPotential: { value: 0 },
      insights: {},
    });
    vi.mocked(getCollectionsData).mockResolvedValue({ reservationsWithBalance: [] });

    const actions = await generateActions('prop-1', 30);

    const channelAction = actions.find((a) => a.id?.startsWith('optimize-channel-'));
    expect(channelAction).toBeDefined();
    expect(channelAction?.category).toBe('channels');
    expect(channelAction?.title).toContain('Optimizar');
  });

  it('returns pricing action for loss pattern', async () => {
    mockGetReservations.mockReturnValue([{ id: 'r1' }]);
    mockGetDataHealth.mockReturnValue({ score: 90, issues: [] });
    mockGetReservationEconomicsSummary.mockReturnValue({
      patterns: [
        {
          source: 'Booking',
          nightsBucket: '1',
          count: 5,
          isLossPattern: true,
          lossAmount: -5000,
          avgProfitPerNight: -100,
        },
      ],
      worstReservations: [],
    });
    mockGetChannelMetrics.mockReturnValue({
      channels: [],
      savingsPotential: { value: 0 },
      insights: {},
    });
    vi.mocked(getCollectionsData).mockResolvedValue({ reservationsWithBalance: [] });

    const actions = await generateActions('prop-1', 30);

    const pricingAction = actions.find((a) => a.id?.startsWith('pricing-') && a.id?.includes('1n'));
    expect(pricingAction).toBeDefined();
    expect(pricingAction?.category).toBe('pricing');
    expect(pricingAction?.title).toContain('Corregir');
    expect(pricingAction?.impact.direction).toBe('down');
  });

  it('returns actions with required shape (id, category, severity, steps with id)', async () => {
    mockGetReservations.mockReturnValue([]);

    const actions = await generateActions('prop-1', 30);

    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('category');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('impact');
      expect(a.impact).toHaveProperty('value');
      expect(a.impact).toHaveProperty('unit');
      expect(a.impact).toHaveProperty('direction');
      expect(Array.isArray(a.steps)).toBe(true);
      for (const step of a.steps || []) {
        expect(step).toHaveProperty('text');
        expect(step).toHaveProperty('completed');
      }
    }
  });
});
