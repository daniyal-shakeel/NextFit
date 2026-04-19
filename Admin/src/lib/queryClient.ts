import { QueryClient } from "@tanstack/react-query";

export const ADMIN_QUERY_STALE_MS = 5 * 60 * 1000;
export const ADMIN_PERSIST_MAX_AGE_MS = 5 * 60 * 1000;
export const ADMIN_QUERY_GC_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ADMIN_QUERY_STALE_MS,
      gcTime: ADMIN_QUERY_GC_MS,
    },
  },
});
