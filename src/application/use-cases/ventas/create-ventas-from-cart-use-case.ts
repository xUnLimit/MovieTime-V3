import { ValidationError } from '@/platform/errors/domain-errors';
import { confirmarPedidoPanel, getPedidoPanelItems } from '@/platform/supabase/pedidos-repository';
import { confirmarPedidoPanelSchema, type ConfirmarPedidoPanelInput } from '@/platform/supabase/pedidos-schemas';
import { toDateOnly } from '@/platform/supabase/dates';
import { z } from '@/platform/validation/zod';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { reportError } from '@/platform/observability/logger';
import { syncTerceroMetodoPagoUseCase } from '../terceros/tercero-metodo-pago-use-cases';
import { getUsdValues, nullableMetodoPagoId, type LogContext, type RecordActivityLog, type VentaInput } from './ventas-shared';

type CartResult = { batchId: string; ventaIds: string[]; sinStock: string[]; monedas: string[]; warnings: string[] };
type CartSession = {
  prepared: Map<string, ConfirmarPedidoPanelInput>;
  completed: Map<string, CartResult>;
};
export function createCartSession(): CartSession {
  return { prepared: new Map(), completed: new Map() };
}

async function prepare(ventas: VentaInput[], key: string): Promise<ConfirmarPedidoPanelInput> {
  if (!ventas.length || ventas.some(v => !v.clienteId || v.clienteId !== ventas[0].clienteId || !v.itemId) || new Set(ventas.map(v => v.itemId)).size !== ventas.length) {
    throw new ValidationError('El carrito requiere items identificados y unicos.');
  }
  const grupos = new Map<string, VentaInput[]>();
  for (const venta of ventas) {
    const moneda = venta.moneda ?? 'USD';
    grupos.set(moneda, [...(grupos.get(moneda) ?? []), venta]);
  }
  const pedidos: ConfirmarPedidoPanelInput['p_panel_pedidos'] = [];
  for (const [moneda, items] of grupos) {
    const monto = Math.round(items.reduce((sum, v) => sum + (v.precioFinal ?? 0), 0) * 100) / 100;
    const { rate } = await getUsdValues(monto, moneda);
    pedidos.push({
      cliente_id: items[0].clienteId ?? '', moneda, exchange_rate: rate, monto,
      crear_key: crypto.randomUUID(), confirmar_key: crypto.randomUUID(),
      items: items.map(v => ({
        tipo: 'nueva', plan_id: v.planId ?? '', servicio_id: v.servicioId, categoria_id: v.categoriaId,
        perfil_numero: v.perfilNumero ?? undefined, ciclo_pago: v.cicloPago ?? 'mensual', descuento: v.descuento ?? 0,
        panel: {
          item_id: v.itemId ?? '', precio: v.precio ?? 0, total: v.precioFinal ?? 0,
          estado: v.estado === 'inactivo' ? 'inactivo' : 'activo',
          fecha_inicio: toDateOnly(v.fechaInicio ?? new Date()), fecha_fin: toDateOnly(v.fechaFin ?? new Date()),
          perfil_nombre: v.perfilNombre ?? '', codigo: v.codigo ?? '', notas: v.notas ?? '',
          metodo_pago_id: nullableMetodoPagoId(v.metodoPagoId), metodo_pago_nombre: v.metodoPagoNombre ?? '',
        },
      })),
    });
  }
  return confirmarPedidoPanelSchema.parse({ p_panel_pedidos: pedidos, p_idempotency_key: key });
}

/** SQL owns all transactional effects. Retrying also recovers a committed response lost in transport. */
export async function createVentasFromCartUseCase(
  ventas: VentaInput[],
  options: { idempotencyKey: string; session: CartSession; logContext: LogContext; recordActivityLog?: RecordActivityLog },
): Promise<CartResult> {
  const { idempotencyKey: key, session } = options;
  const completed = session.completed.get(key);
  if (completed) return completed;
  let payload = session.prepared.get(key);
  if (!payload) {
    payload = await prepare(ventas, key);
    session.prepared.set(key, payload);
  }
  const batchId = await confirmarPedidoPanel(payload);
  // A read failure is recoverable with the same key; never undo a potentially committed payment.
  const { pedidos, items } = await getPedidoPanelItems(batchId);
  if (items.length !== ventas.length) throw new ValidationError('No se pudieron recuperar todos los items del pedido.');
  const resolved = items.map(item => {
    const { item_id: itemId } = z.object({ item_id: z.string() }).parse(item.panel_snapshot);
    const venta = ventas.find(v => v.itemId === itemId);
    if (!venta) throw new ValidationError('El item confirmado no pertenece al carrito.');
    if (item.estado !== 'sin_stock' && (item.estado !== 'aplicado' || !item.venta_id_resultante)) {
      throw new ValidationError('No se pudo recuperar la venta confirmada.');
    }
    return { item, itemId, venta };
  });
  if (new Set(resolved.map(r => r.itemId)).size !== items.length) {
    throw new ValidationError('Los items confirmados no son unicos.');
  }
  const result: CartResult = { batchId, ventaIds: [], sinStock: [], monedas: pedidos.map(p => p.moneda), warnings: [] };
  const emit = (event: Parameters<typeof storeEventBus.emit>[0]) => {
    try {
      storeEventBus.emit(event);
    } catch (error) {
      reportError('CreateVentasFromCart', 'Error actualizando eventos del pedido confirmado', error);
      result.warnings.push('No se pudo completar una actualizacion de datos secundarios.');
    }
  };
  for (const { item, itemId, venta } of resolved) {
    if (item.estado === 'sin_stock') {
      result.sinStock.push(`${venta.servicioNombre} (${itemId})`);
      continue;
    }
    if (!item.venta_id_resultante) throw new ValidationError('No se pudo recuperar la venta confirmada.');
    const ventaId = item.venta_id_resultante;
    result.ventaIds.push(ventaId);
    emit({ type: 'VENTA_CREATED', ventaId });
    try {
      await options.recordActivityLog?.({
        ...options.logContext, accion: 'creacion', entidad: 'venta', entidadId: ventaId,
        entidadNombre: `${venta.clienteNombre} - ${venta.servicioNombre}`,
        detalles: `Venta creada: ${venta.clienteNombre} / ${venta.servicioNombre} - ${item.total} ${venta.moneda} - ${toDateOnly(venta.fechaInicio ?? new Date())} al ${toDateOnly(venta.fechaFin ?? new Date())} (${item.ciclo_pago})`,
        metadata: { pedidoId: item.pedido_id, itemId, precioFinal: item.total, moneda: venta.moneda,
          cicloPago: item.ciclo_pago, clienteId: venta.clienteId, servicioId: venta.servicioId,
          fechaInicio: toDateOnly(venta.fechaInicio ?? new Date()), fechaFin: toDateOnly(venta.fechaFin ?? new Date()),
          origen: 'createVentasFromCartUseCase' },
      });
    } catch (error) {
      reportError('CreateVentasFromCart', 'Error registrando actividad del pedido confirmado', error);
      result.warnings.push('No se pudo registrar una entrada de actividad.');
    }
  }
  emit({ type: 'DASHBOARD_INVALIDATED' });
  emit({ type: 'NOTIFICACIONES_INVALIDATED', entity: 'venta' });
  try {
    await syncTerceroMetodoPagoUseCase({ terceroId: ventas[0].clienteId, metodoPagoId: ventas[0].metodoPagoId });
  } catch (error) {
    reportError('CreateVentasFromCart', 'Error sincronizando metodo de pago del tercero', error);
    result.warnings.push('No se pudo actualizar el metodo de pago en terceros.');
  }
  session.completed.set(key, result);
  return result;
}
