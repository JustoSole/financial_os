import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { RequestResult } from '../api';

/**
 * Generic hook that wraps any API function with React Query caching.
 *
 * - Deduplicates in-flight requests automatically
 * - Returns cached data instantly on revisit (stale-while-revalidate)
 * - Only refetches when key changes or data becomes stale
 */
export function useApiQuery<T>(
  key: unknown[],
  fetcher: () => Promise<RequestResult<T>>,
  options?: Omit<UseQueryOptions<T | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T | null, Error>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetcher();
      if (!res.success) {
        throw new Error(res.error || 'Error de conexión');
      }
      return res.data ?? null;
    },
    ...options,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (keyPrefix: unknown[]) => qc.invalidateQueries({ queryKey: keyPrefix });
}
