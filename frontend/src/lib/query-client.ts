import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: data is fresh, no refetch
      gcTime: 15 * 60 * 1000, // 15 min: keep in cache after unmount
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: 1000,
    },
  },
});
