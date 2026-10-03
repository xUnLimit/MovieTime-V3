import { DomainError } from '@/platform/errors/domain-errors';
import { assertUuid } from '@/platform/utils/safety';
import { supabase } from './client';
import type { Database } from './database.types';
import { cancelarPedidoRpc, confirmarPedidoRpc, crearPedidoRpc, confirmarPedidoPanelRpc } from './pedidos-rpc-adapter';
import type { CancelarPedidoInput, ConfirmarPedidoInput, CrearPedidoInput, ConfirmarPedidoPanelInput } from './pedidos-schemas';

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

export function confirmarPedidoPanel(input: ConfirmarPedidoPanelInput): Promise<string> {
  return confirmarPedidoPanelRpc(input);
}

export async function getPedidoPanelItems(batchId: string) {
  assertUuid(batchId, 'Pedido');
  const { data: pedidos, error: pedidoError } = await supabase.from('pedidos')
    .select('id, moneda').eq('panel_batch_id', batchId);
  if (pedidoError || !pedidos?.length) throw new DomainError('No se pudo consultar el pedido confirmado.', 'PEDIDO_READ_FAILED');
  const { data: items, error } = await supabase.from('pedido_items').select('*').in('pedido_id', pedidos.map(p => p.id));
  if (error || !items) throw new DomainError('No se pudo consultar los items del pedido.', 'PEDIDO_READ_FAILED');
  return { pedidos, items };
}
