import { DomainError } from '@/platform/errors/domain-errors';
import { assertUuid } from '@/platform/utils/safety';
import { supabase } from './client';
import type { Database } from './database.types';
import { cancelarPedidoRpc, confirmarPedidoRpc, crearPedidoRpc } from './pedidos-rpc-adapter';
import type { CancelarPedidoInput, ConfirmarPedidoInput, CrearPedidoInput } from './pedidos-schemas';

export type Pedido = Database['public']['Tables']['pedidos']['Row'];

export async function getPedido(id: string): Promise<Pedido | null> {
  assertUuid(id, 'Pedido');
  const { data, error } = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (error) throw new DomainError('No se pudo consultar el pedido.', 'PEDIDO_READ_FAILED');
  return data;
}

export function crearPedido(input: CrearPedidoInput): Promise<string> { return crearPedidoRpc(input); }
export function confirmarPedido(input: ConfirmarPedidoInput): Promise<string> { return confirmarPedidoRpc(input); }
export function cancelarPedido(input: CancelarPedidoInput): Promise<string> { return cancelarPedidoRpc(input); }
