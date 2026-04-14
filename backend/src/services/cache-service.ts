type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.DEFAULT_TTL,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
export default cacheService;
