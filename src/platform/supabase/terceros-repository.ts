import { getAll, getById, getCount, countFromView, create, update, remove } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';
import { ConflictError } from '@/platform/errors/domain-errors';
import { assertUuid } from '@/platform/utils/safety';

export const getTerceros = <T>() => getAll<T>(ENTITIES.TERCEROS);
export const getTerceroById = <T>(id: string) => getById<T>(ENTITIES.TERCEROS, id);

// Contar por servicios activos requiere la vista derivada; el resto usa el conteo generico.
export const countTerceros = (filters: QueryFilter[] = []) =>
  filters.some((filter) => filter.field === 'serviciosActivos')
    ? countFromView(ENTITIES.TERCEROS, 'v_terceros_servicios_activos', filters, {
        serviciosActivos: 'servicios_activos',
      })
    : getCount(ENTITIES.TERCEROS, filters);
export const createTercero = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TERCEROS, payload);
export const updateTercero = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TERCEROS, id, payload);
export async function removeTercero(id: string): Promise<void> {
  assertUuid(id, 'Tercero');
  try {
    await remove(ENTITIES.TERCEROS, id);
  } catch (error) {
    const diagnostic = error instanceof Error && error.cause !== undefined ? error.cause : error;
    if (diagnostic && typeof diagnostic === 'object' && 'code' in diagnostic && diagnostic.code === 'P0001'
      && 'message' in diagnostic && diagnostic.message === 'tercero_has_active_orders') {
      throw new ConflictError('El cliente tiene pedidos en la lista. Elimínalos desde Pedidos y cobros antes de eliminar al cliente. Sus ventas y pagos se conservan en el historial.');
    }
    if (diagnostic && typeof diagnostic === 'object' && 'code' in diagnostic && diagnostic.code === '23503') {
      throw new ConflictError(
        'No se puede eliminar el tercero porque tiene registros asociados que impiden su eliminación. Revisa sus pedidos u otras dependencias.',
      );
    }
    throw error;
  }
}
