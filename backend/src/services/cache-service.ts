/**
 * Simple in-memory cache for performance optimization
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get an item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.DEFAULT_TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set an item in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cache entries (call this after data import)
   */
  clear(): void {
    console.log('🧹 Clearing performance cache...');
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
export default cacheService;

