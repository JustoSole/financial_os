import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService } from './cache-service';

describe('cache-service', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  it('returns null for missing key', () => {
    expect(cacheService.get('missing')).toBe(null);
  });

  it('returns value after set', () => {
    cacheService.set('key1', { foo: 42 });
    expect(cacheService.get('key1')).toEqual({ foo: 42 });
  });

  it('overwrites value on second set', () => {
    cacheService.set('key1', 1);
    cacheService.set('key1', 2);
    expect(cacheService.get('key1')).toBe(2);
  });

  it('clear removes all entries', () => {
    cacheService.set('a', 1);
    cacheService.set('b', 2);
    cacheService.clear();
    expect(cacheService.get('a')).toBe(null);
    expect(cacheService.get('b')).toBe(null);
  });

  it('returns null for expired entry (past TTL)', async () => {
    cacheService.set('key1', 'value');
    expect(cacheService.get('key1')).toBe('value');
    // Default TTL is 5 min; advance time by 6 minutes
    vi.useFakeTimers();
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(cacheService.get('key1')).toBe(null);
    vi.useRealTimers();
  });
});
