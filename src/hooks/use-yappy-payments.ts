'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { syncYappyNowUseCase, dismissYappyUseCase, fetchYappyCandidateVentas, fetchYappyConnections, fetchYappyPayments, resolveYappyUseCase, searchYappyVentas } from '@/application/use-cases/yappy-use-cases';

const keys = { payments: ['yappy', 'payments'], connections: ['yappy', 'connections'], ventas: ['yappy', 'ventas'] } as const;
export function useYappyPayments() { return useQuery({ queryKey: keys.payments, queryFn: fetchYappyPayments, refetchInterval: 30_000 }); }
export function useYappyConnections() { return useQuery({ queryKey: keys.connections, queryFn: fetchYappyConnections, refetchInterval: 30_000 }); }
export function useYappyCandidateVentas(candidateIds: string[] = []) {
  const uniqueIds = [...new Set(candidateIds)].sort();
  return useQuery({ queryKey: [...keys.ventas, ...uniqueIds], queryFn: () => fetchYappyCandidateVentas(uniqueIds) });
}
export function useYappyVentaSearch(term: string, enabled: boolean) {
  return useQuery({ queryKey: ['yappy', 'venta-search', term], queryFn: () => searchYappyVentas(term), enabled: enabled && term.trim().length >= 2 });
}
export function useYappyActions() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: keys.payments });
  return {
    sync: useMutation({ mutationFn: syncYappyNowUseCase, onSuccess: async () => {
      await Promise.all([invalidate(), client.invalidateQueries({ queryKey: keys.connections })]);
    } }),
    resolve: useMutation({ mutationFn: ({ paymentId, ventaId }: { paymentId: string; ventaId: string }) => resolveYappyUseCase(paymentId, ventaId), onSuccess: invalidate }),
    dismiss: useMutation({ mutationFn: ({ paymentId, note }: { paymentId: string; note: string }) => dismissYappyUseCase(paymentId, note), onSuccess: invalidate }),
  };
}
