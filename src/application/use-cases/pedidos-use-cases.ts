import { ValidationError } from '@/platform/errors/domain-errors';
import { cancelarPedido, confirmarPedido, crearPedido } from '@/platform/supabase/pedidos-repository';
import {
  cancelarPedidoSchema, confirmarPedidoSchema, crearPedidoSchema,
  type CancelarPedidoInput, type ConfirmarPedidoInput, type CrearPedidoInput,
} from '@/platform/supabase/pedidos-schemas';

export async function crearPedidoUseCase(input: CrearPedidoInput): Promise<string> {
  const payload = crearPedidoSchema.parse(input);
  if (Date.parse(payload.p_expira_at) <= Date.now()) {
    throw new ValidationError('El pedido debe expirar en el futuro.');
  }
  const renewals = payload.p_items.filter(i => i.tipo === 'renovacion').map(i => i.venta_id);
  if (new Set(renewals).size !== renewals.length) {
    throw new ValidationError('Una venta solo puede renovarse una vez por pedido.');
  }
  return crearPedido(payload);
}

export async function confirmarPedidoUseCase(input: ConfirmarPedidoInput): Promise<string> {
  return confirmarPedido(confirmarPedidoSchema.parse(input));
}

export async function cancelarPedidoUseCase(input: CancelarPedidoInput): Promise<string> {
  return cancelarPedido(cancelarPedidoSchema.parse(input));
}
