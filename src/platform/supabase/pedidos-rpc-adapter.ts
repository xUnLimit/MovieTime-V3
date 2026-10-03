import { DomainError } from '@/platform/errors/domain-errors';
import { assertRpcStringId } from '@/platform/utils/safety';
import { executeIdempotentRpc } from './idempotent-rpc';
import { assertOnlineMutation } from './online-mutation';
import { callRpc } from './rpc-client';
import {
  cancelarPedidoSchema, confirmarPedidoSchema, crearPedidoSchema, confirmarPedidoPanelSchema,
  type CancelarPedidoInput, type ConfirmarPedidoInput, type CrearPedidoInput, type ConfirmarPedidoPanelInput,
} from './pedidos-schemas';

async function publicResult(operation: string, send: () => Promise<string>): Promise<string> {
  try {
    return assertRpcStringId(await send(), operation);
  } catch {
    // SQL and transport details must not escape to the caller. The key remains
    // pending in executeIdempotentRpc so the exact intent can be retried safely.
    throw new DomainError('No se pudo registrar el pedido. Revisa su estado antes de reintentar.',
      'PEDIDO_RPC_FAILED', { operation });
  }
}

export async function crearPedidoRpc(input: CrearPedidoInput): Promise<string> {
  const payload = crearPedidoSchema.parse(input);
  assertOnlineMutation();
  return publicResult('crear_pedido', () => executeIdempotentRpc('crear_pedido', payload,
    request => callRpc('crear_pedido', request)));
}

export async function confirmarPedidoRpc(input: ConfirmarPedidoInput): Promise<string> {
  const payload = confirmarPedidoSchema.parse(input);
  assertOnlineMutation();
  return publicResult('confirmar_pedido', () => executeIdempotentRpc('confirmar_pedido', payload,
    request => callRpc('confirmar_pedido', request)));
}

export async function cancelarPedidoRpc(input: CancelarPedidoInput): Promise<string> {
  const payload = cancelarPedidoSchema.parse(input);
  assertOnlineMutation();
  return publicResult('cancelar_pedido', () => executeIdempotentRpc('cancelar_pedido', payload,
    request => callRpc('cancelar_pedido', request)));
}

export async function confirmarPedidoPanelRpc(input: ConfirmarPedidoPanelInput): Promise<string> {
  const payload = confirmarPedidoPanelSchema.parse(input);
  assertOnlineMutation();
  return publicResult('confirmar_pedido_panel', () => executeIdempotentRpc('confirmar_pedido_panel', payload,
    request => callRpc('confirmar_pedido', request)));
}
