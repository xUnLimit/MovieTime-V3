'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { syncYappyNowUseCase, dismissYappyUseCase, fetchYappyCandidateVentas, fetchYappyConnections, fetchYappyPayments, resolveYappyUseCase, searchYappyVentas } from '@/application/use-cases/yappy-use-cases';
import { useAuthStore } from '@/store/authStore';

const keys = { payments: ['yappy', 'payments'], connections: ['yappy', 'connections'], ventas: ['yappy', 'ventas'] } as const;
// La cola de cobros es solo de administradores: sin ese rol no se consulta nada (RLS sigue siendo la autorización real).
const useIsAdmin = () => useAuthStore(state => state.user?.role === 'admin');

export function useYappyPayments() {
  const admin = useIsAdmin();
  return useQuery({ queryKey: keys.payments, queryFn: fetchYappyPayments, enabled: admin, refetchInterval: 30_000 });
}
export function useYappyConnections() {
  const admin = useIsAdmin();
  return useQuery({ queryKey: keys.connections, queryFn: fetchYappyConnections, enabled: admin, refetchInterval: 30_000 });
}
export function useYappyCandidateVentas(candidateIds: string[] = []) {
  const admin = useIsAdmin();
  const uniqueIds = [...new Set(candidateIds)].sort();
  return useQuery({ queryKey: [...keys.ventas, ...uniqueIds], queryFn: () => fetchYappyCandidateVentas(uniqueIds), enabled: admin });
}
export function useYappyVentaSearch(term: string, enabled: boolean) {
  const admin = useIsAdmin();
  return useQuery({ queryKey: ['yappy', 'venta-search', term], queryFn: () => searchYappyVentas(term), enabled: admin && enabled && term.trim().length >= 2 });
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
