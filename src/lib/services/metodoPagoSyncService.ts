import { COLLECTIONS, queryDocuments, update } from '@/lib/firebase/firestore';

/**
 * Propagates payment method changes to all dependent entities.
 *
 * Affected entities:
 * - Ventas (metodoPagoNombre, moneda)
 * - PagosVenta (metodoPago, moneda)
 * - Servicios (metodoPagoNombre, moneda)
 * - PagosServicio (metodoPago, moneda)
 *
 * @remarks
 * **Partial failure / rollback:** This function does NOT use Firestore transactions.
 * If a step fails mid-way (e.g., `pagosServicio` after `ventas` are updated),
 * the already-written entities will remain updated while the remaining ones will not.
 * This is acceptable because `performGlobalSync()` can repair any inconsistencies on demand.
 * Do NOT retry this function automatically on failure — call `performGlobalSync` instead.
 */
export async function syncMetodoPagoDependencias(params: {
  id: string;
  nombre?: string;
  moneda?: string;
  nombreAnterior?: string;
  monedaAnterior?: string;
}) {
  const { id, nombre, moneda, nombreAnterior, monedaAnterior } = params;

  // Si no cambió ni el nombre ni la moneda, no hay nada que sincronizar
  if (nombre === nombreAnterior && moneda === monedaAnterior) {
    return;
  }

  const updates: Record<string, unknown> = {};
  if (nombre !== undefined) updates.metodoPagoNombre = nombre;
  if (moneda !== undefined) updates.moneda = moneda;

  const paymentUpdates: Record<string, unknown> = {};
  if (nombre !== undefined) paymentUpdates.metodoPago = nombre;
  if (moneda !== undefined) paymentUpdates.moneda = moneda;

  try {
    // 1. Sincronizar VENTAS
    const ventas = await queryDocuments<{ id: string }>(COLLECTIONS.VENTAS, [
      { field: 'metodoPagoId', operator: '==', value: id }
    ]);
    if (ventas.length > 0) {
      await Promise.all(ventas.map(v => update(COLLECTIONS.VENTAS, v.id, updates)));
    }

    // 2. Sincronizar PAGOS_VENTA
    const pagosVenta = await queryDocuments<{ id: string }>(COLLECTIONS.PAGOS_VENTA, [
      { field: 'metodoPagoId', operator: '==', value: id }
    ]);
    if (pagosVenta.length > 0) {
      await Promise.all(pagosVenta.map(p => update(COLLECTIONS.PAGOS_VENTA, p.id, paymentUpdates)));
    }

    // 3. Sincronizar SERVICIOS
    const servicios = await queryDocuments<{ id: string }>(COLLECTIONS.SERVICIOS, [
      { field: 'metodoPagoId', operator: '==', value: id }
    ]);
    if (servicios.length > 0) {
      await Promise.all(servicios.map(s => update(COLLECTIONS.SERVICIOS, s.id, updates)));
    }

    // 4. Sincronizar PAGOS_SERVICIO
    const pagosServicio = await queryDocuments<{ id: string }>(COLLECTIONS.PAGOS_SERVICIO, [
      { field: 'metodoPagoId', operator: '==', value: id }
    ]);
    if (pagosServicio.length > 0) {
      await Promise.all(pagosServicio.map(p => update(COLLECTIONS.PAGOS_SERVICIO, p.id, paymentUpdates)));
    }

    console.log(`[SyncMetodoPago] Sincronización completada para ID: ${id}`);
  } catch (error) {
    console.error(`[SyncMetodoPago] Error en sincronización para ID: ${id}`, error);
    throw error;
  }
}
