'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelPedidoUseCase, deletePedidoUseCase, listPedidosUseCase, markPedidoDeliveredUseCase, reconcilePedidoUseCase, registerPedidoPaymentUseCase, resolvePedidoExcessUseCase, retryPedidoUseCase } from '@/application/use-cases/pedidos-use-cases';
import { useAuthStore } from '@/store/authStore';
import { requestPedidoDeliveryRetryUseCase } from '@/application/use-cases/pedido-delivery-use-cases';

const queryKey = ['pedidos'] as const;

export function usePedidos(enabled = true) {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return useQuery({ queryKey, queryFn: listPedidosUseCase, enabled: admin && enabled, refetchInterval: 30_000 });
}

export function usePedidoActions() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const keyFor = (scope: string) => {
    const current = keys.current.get(scope) ?? crypto.randomUUID();
    keys.current.set(scope, current);
    return current;
  };
  const complete = async (scope: string) => { keys.current.delete(scope); await client.invalidateQueries({ queryKey }); };
  return {
    excess: useMutation({ mutationFn: ({ id, action, reference, amount }: { id: string; action: 'credito' | 'reembolsado'; reference: string; amount: number }) => resolvePedidoExcessUseCase(id, action, reference, amount, keyFor(`excess:${id}:${action}:${reference}:${amount}`)), onSuccess: (_, input) => complete(`excess:${input.id}:${input.action}:${input.reference}:${input.amount}`) }),
    remove: useMutation({ mutationFn: (id: string) => deletePedidoUseCase(id, keyFor(`delete:${id}`)), onSuccess: (_, id) => complete(`delete:${id}`) }),
    payment: useMutation({ mutationFn: ({ id, amount, reference }: { id: string; amount: number; reference: string }) => registerPedidoPaymentUseCase(id, amount, reference, keyFor(`payment:${id}:${amount}:${reference}`)), onSuccess: (_, input) => complete(`payment:${input.id}:${input.amount}:${input.reference}`) }),
    delivered: useMutation({ mutationFn: (id: string) => markPedidoDeliveredUseCase(id, keyFor(`delivered:${id}`)), onSuccess: (_, id) => complete(`delivered:${id}`) }),
    delivery: useMutation({ mutationFn: requestPedidoDeliveryRetryUseCase, onSuccess: () => client.invalidateQueries({ queryKey }) }),
    retry: useMutation({ mutationFn: (id: string) => retryPedidoUseCase(id, keyFor(`retry:${id}`)), onSuccess: (_, id) => complete(`retry:${id}`) }),
    cancel: useMutation({ mutationFn: (id: string) => cancelPedidoUseCase(id, keyFor(`cancel:${id}`)), onSuccess: (_, id) => complete(`cancel:${id}`) }),
    reconcile: useMutation({ mutationFn: ({ id, code }: { id: string; code: string }) => reconcilePedidoUseCase(id, code, keyFor(`reconcile:${id}:${code}`)), onSuccess: (_, { id, code }) => complete(`reconcile:${id}:${code}`) }),
  };
}
