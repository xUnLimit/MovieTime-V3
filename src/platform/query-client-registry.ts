import type { QueryClient } from '@tanstack/react-query';

let activeQueryClient: QueryClient | null = null;

export function registerActiveQueryClient(queryClient: QueryClient) {
  activeQueryClient = queryClient;

  return () => {
    if (activeQueryClient === queryClient) {
      activeQueryClient = null;
    }
  };
}

export function getActiveQueryClient() {
  return activeQueryClient;
}
