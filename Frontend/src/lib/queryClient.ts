import { QueryClient } from "@tanstack/react-query";

export const FRONTEND_QUERY_STALE_MS = 5 * 60 * 1000;
export const FRONTEND_PERSIST_MAX_AGE_MS = 5 * 60 * 1000;
export const FRONTEND_QUERY_GC_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FRONTEND_QUERY_STALE_MS,
      gcTime: FRONTEND_QUERY_GC_MS,
    },
  },
});

export const frontendProductsListKey = (slug: string) =>
  ["frontend", "products", "list", slug] as const;
