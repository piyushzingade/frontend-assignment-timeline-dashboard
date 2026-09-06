import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The api client already retries retryable (5xx) failures with backoff,
      // so query-level retries would only double up on the same failures.
      retry: false,
      // Dashboard data is historical and refresh is manual by design.
      refetchOnWindowFocus: false,
      gcTime: 30 * 60 * 1000,
    },
  },
})
