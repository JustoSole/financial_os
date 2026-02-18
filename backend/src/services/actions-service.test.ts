import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCompletedSteps } from './actions-service';

vi.mock('../db', () => ({
  default: {
    getCompletedSteps: vi.fn(),
  },
}));

import database from '../db';

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
