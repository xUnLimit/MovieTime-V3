'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptPedidoResolutionQuoteUseCase, assignPedidoItemsUseCase, getPedidoResolutionQuoteUseCase, refundPedidoUnallocatedUseCase } from '@/application/use-cases/pedido-resolution-use-cases';

export function usePedidoResolution(id: string, showQuote: boolean) {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const key = (scope: string) => { const value = keys.current.get(scope) ?? crypto.randomUUID(); keys.current.set(scope, value); return value; };
  const complete = async (scope: string) => { keys.current.delete(scope); await client.invalidateQueries({ queryKey: ['pedidos'] }); await client.invalidateQueries({ queryKey: ['pedido-resolution', id] }); };
  return {
    quote: useQuery({ queryKey: ['pedido-resolution', id], queryFn: () => getPedidoResolutionQuoteUseCase(id), enabled: showQuote }),
    accept: useMutation({ mutationFn: (total: number) => acceptPedidoResolutionQuoteUseCase(id, total, key(`price:${total}`)), onSuccess: (_, total) => complete(`price:${total}`) }),
    refund: useMutation({ mutationFn: ({ reference, amount }: { reference: string; amount: number }) => refundPedidoUnallocatedUseCase(id, reference, amount, key(`refund:${reference}:${amount}`)), onSuccess: (_, input) => complete(`refund:${input.reference}:${input.amount}`) }),
    assign: useMutation({ mutationFn: ({ itemIds, amount }: { itemIds: string[]; amount: number }) => assignPedidoItemsUseCase(id, itemIds, amount, key(`assign:${itemIds.join(',')}:${amount}`)), onSuccess: (_, input) => complete(`assign:${input.itemIds.join(',')}:${input.amount}`) }),
  };
}
