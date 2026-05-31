import {
  afterMetodoPagoCreated,
  afterMetodoPagoDeleted,
  afterMetodoPagoUpdated,
  afterTipoGastoUpdated,
} from '@/application/store-reactions/catalogos-mutation-reactions';
import {
  createCategoriaUseCase,
  deleteCategoriaUseCase,
  updateCategoriaUseCase,
} from '@/application/use-cases/categorias-use-cases';
import {
  createMetodoPagoUseCase,
  deleteMetodoPagoUseCase,
  getMetodoPagoUseCase,
  updateMetodoPagoUseCase,
} from '@/application/use-cases/metodos-pago-use-cases';
import {
  createTipoGastoUseCase,
  deleteTipoGastoUseCase,
  getTipoGastoUseCase,
  updateTipoGastoUseCase,
} from '@/application/use-cases/tipos-gasto-use-cases';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { Categoria, MetodoPago, TipoGasto } from '@/types';

export async function createCategoriaMutation(categoria: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>) {
  await createCategoriaUseCase(categoria, getActivityLogOptions());
  await invalidateStoreQueries(['categorias', 'servicios', 'ventas', 'pagination']);
}

export async function updateCategoriaMutation(id: string, updates: Partial<Categoria>, oldCategoria?: Categoria) {
  await updateCategoriaUseCase(id, updates, {
    oldCategoria,
    ...getActivityLogOptions(),
  });
  await invalidateStoreQueries(['categorias', 'servicios', 'ventas', 'pagination']);
}

export async function deleteCategoriaMutation(id: string, categoria?: Categoria) {
  // deleteCategoriaUseCase emite CATEGORIA_DELETED (unico emisor del hecho de dominio).
  await deleteCategoriaUseCase(id, {
    categoria,
    ...getActivityLogOptions(),
  });
  await invalidateStoreQueries(['categorias', 'servicios', 'ventas', 'pagination']);
}

export async function createMetodoPagoMutation(metodo: Omit<MetodoPago, 'id' | 'createdAt' | 'updatedAt'>) {
  const newMetodo = await createMetodoPagoUseCase(metodo);
  await afterMetodoPagoCreated(newMetodo);
  await invalidateStoreQueries(['metodosPago', 'terceros', 'servicios', 'ventas', 'pagination']);
}

export async function updateMetodoPagoMutation(id: string, updates: Partial<MetodoPago>, oldMetodo?: MetodoPago) {
  const resolvedOldMetodo = oldMetodo ?? await getMetodoPagoUseCase(id) ?? undefined;
  await updateMetodoPagoUseCase(id, updates);
  await afterMetodoPagoUpdated({ metodoId: id, oldMetodo: resolvedOldMetodo, updates });
  await invalidateStoreQueries(['metodosPago', 'terceros', 'servicios', 'ventas', 'pagination']);
}

export async function toggleMetodoPagoActivoMutation(id: string, metodo?: MetodoPago) {
  const resolvedMetodo = metodo ?? await getMetodoPagoUseCase(id);
  if (!resolvedMetodo) throw new Error('Metodo de pago no encontrado');
  await updateMetodoPagoMutation(id, { activo: !resolvedMetodo.activo }, resolvedMetodo);
}

export async function deleteMetodoPagoMutation(id: string, metodo?: MetodoPago) {
  const resolvedMetodo = metodo ?? await getMetodoPagoUseCase(id) ?? undefined;
  await deleteMetodoPagoUseCase(id);
  await afterMetodoPagoDeleted(id, resolvedMetodo);
  await invalidateStoreQueries(['metodosPago', 'terceros', 'servicios', 'ventas', 'pagination']);
}

export async function createTipoGastoMutation(tipoGasto: Omit<TipoGasto, 'id' | 'createdAt' | 'updatedAt'>) {
  await createTipoGastoUseCase(tipoGasto);
  await invalidateStoreQueries(['tiposGasto', 'gastos', 'dashboard', 'pagination']);
}

export async function updateTipoGastoMutation(id: string, updates: Partial<TipoGasto>) {
  const { tipoActual, finalUpdates } = await updateTipoGastoUseCase(id, updates);
  await afterTipoGastoUpdated(id, tipoActual, finalUpdates);
  await invalidateStoreQueries(['tiposGasto', 'gastos', 'dashboard', 'pagination']);
}

export async function toggleTipoGastoActivoMutation(id: string) {
  const tipo = await getTipoGastoUseCase(id);
  if (!tipo) throw new Error('Tipo de gasto no encontrado');
  await updateTipoGastoMutation(id, { activo: !tipo.activo });
}

export async function deleteTipoGastoMutation(id: string) {
  await deleteTipoGastoUseCase(id);
  await invalidateStoreQueries(['tiposGasto', 'gastos', 'dashboard', 'pagination']);
}
