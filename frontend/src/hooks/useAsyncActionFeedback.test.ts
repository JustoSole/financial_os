import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncActionFeedback } from './useAsyncActionFeedback';

describe('useAsyncActionFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with no message', () => {
    const { result } = renderHook(() => useAsyncActionFeedback());
    expect(result.current.status).toBe('idle');
    expect(result.current.loading).toBe(false);
    expect(result.current.success).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.message).toBe(null);
  });

  it('sets loading then success when run resolves', async () => {
    const { result } = renderHook(() =>
      useAsyncActionFeedback({ successMessage: 'Guardado', successResetMs: 3000 })
    );

    let resolveFn: () => void;
    const p = new Promise<void>((r) => { resolveFn = r; });

    await act(async () => {
      result.current.run(async () => { await p; });
    });
    expect(result.current.status).toBe('loading');
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFn!();
    });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('success');
    expect(result.current.success).toBe(true);
    expect(result.current.message).toBe('Guardado');

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBe(null);
  });

  it('sets loading then error when run rejects', async () => {
    const { result } = renderHook(() =>
      useAsyncActionFeedback({ errorMessage: 'Error al guardar' })
    );

    await act(async () => {
      result.current.run(async () => { throw new Error('Network error'); });
    });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('reset clears status and message', async () => {
    const { result } = renderHook(() => useAsyncActionFeedback());

    await act(async () => {
      result.current.run(async () => { throw new Error('Fail'); });
    });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('error');

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBe(null);
    expect(result.current.error).toBe(null);
  });
});
