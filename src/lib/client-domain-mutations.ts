import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import {
  afterCategoriaDeleted,
  afterMetodoPagoCreated,
  afterMetodoPagoDeleted,
  afterMetodoPagoUpdated,
  afterTipoGastoUpdated,
} from '@/lib/store-reactions/catalogos-mutation-reactions';
import {
  afterServicioCreated,
  afterServicioDeleted,
  afterServicioUpdated,
} from '@/lib/store-reactions/servicios-mutation-reactions';
import {
  afterTemplateCreated,
  afterTemplateDeleted,
  afterTemplateUpdated,
} from '@/lib/store-reactions/templates-mutation-reactions';
import {
  afterTerceroDeleted,
  afterTerceroUpdated,
} from '@/lib/store-reactions/terceros-mutation-reactions';
import {
  afterVentaCreated,
  afterVentaDeleted,
  afterVentaUpdated,
} from '@/lib/store-reactions/ventas-mutation-reactions';
import {
  createCategoriaUseCase,
  deleteCategoriaUseCase,
  updateCategoriaUseCase,
} from '@/lib/use-cases/categorias-use-cases';
import {
  createGastoUseCase,
  deleteGastoUseCase,
  updateGastoUseCase,
} from '@/lib/use-cases/gastos-use-cases';
import {
  createMetodoPagoUseCase,
  deleteMetodoPagoUseCase,
  getMetodoPagoUseCase,
  updateMetodoPagoUseCase,
} from '@/lib/use-cases/metodos-pago-use-cases';
import {
  createServicioUseCase,
  deleteServicioUseCase,
  updateServicioUseCase,
} from '@/lib/use-cases/servicios/servicios-write-use-cases';
import {
  createTemplateUseCase,
  deleteTemplateUseCase,
  updateTemplateUseCase,
} from '@/lib/use-cases/templates-use-cases';
import {
  createTerceroUseCase,
  deleteTerceroUseCase,
  getTerceroUseCase,
  resolveTerceroForDelete,
  updateTerceroUseCase,
} from '@/lib/use-cases/terceros-use-cases';
import {
  createTipoGastoUseCase,
  deleteTipoGastoUseCase,
  getTipoGastoUseCase,
  updateTipoGastoUseCase,
} from '@/lib/use-cases/tipos-gasto-use-cases';
import {
  createVentaUseCase,
  deleteVentaUseCase,
  updateVentaUseCase,
} from '@/lib/use-cases/ventas/ventas-write-use-cases';
import { invalidateStoreQueries } from '@/store/store-query-invalidation';
import type { Categoria, Gasto, MetodoPago, Servicio, TemplateMensaje, Tercero, TipoGasto, VentaDoc } from '@/types';

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
  await deleteCategoriaUseCase(id, {
    categoria,
    ...getActivityLogOptions(),
  });
  await afterCategoriaDeleted(id);
  await invalidateStoreQueries(['categorias', 'servicios', 'ventas', 'pagination']);
}

export async function createGastoMutation(
  gasto: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'tipoGastoNombre'>,
) {
  await createGastoUseCase(gasto);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
}

export async function updateGastoMutation(
  id: string,
  updates: Partial<Omit<Gasto, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  await updateGastoUseCase(id, updates);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
}

export async function deleteGastoMutation(id: string) {
  await deleteGastoUseCase(id);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
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

export async function createTemplateMutation(template: Omit<TemplateMensaje, 'id' | 'createdAt' | 'updatedAt'>) {
  const newTemplate = await createTemplateUseCase(template);
  await afterTemplateCreated(newTemplate);
  await invalidateStoreQueries(['templates', 'notificaciones']);
}

export async function updateTemplateMutation(id: string, updates: Partial<TemplateMensaje>, oldTemplate?: TemplateMensaje) {
  await updateTemplateUseCase(id, updates);
  await afterTemplateUpdated({ templateId: id, oldTemplate, updates });
  await invalidateStoreQueries(['templates', 'notificaciones']);
}

export async function deleteTemplateMutation(id: string, template?: TemplateMensaje) {
  await deleteTemplateUseCase(id);
  await afterTemplateDeleted(id, template);
  await invalidateStoreQueries(['templates', 'notificaciones']);
}

export async function createTerceroMutation(usuario: Omit<Tercero, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>) {
  await createTerceroUseCase(usuario, getActivityLogOptions());
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}

export async function updateTerceroMutation(id: string, updates: Partial<Tercero>, oldTercero?: Tercero) {
  const resolvedOldTercero = oldTercero ?? await getTerceroUseCase<Tercero>(id) ?? undefined;
  const {
    shouldRefreshNotificaciones,
    shouldDispatchTerceroNombreUpdated,
  } = await updateTerceroUseCase(id, updates, {
    oldTercero: resolvedOldTercero,
    ...getActivityLogOptions(),
  });

  await afterTerceroUpdated({
    terceroId: id,
    shouldRefreshNotificaciones,
    shouldDispatchTerceroNombreUpdated,
  });
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}

export async function deleteTerceroMutation(
  id: string,
  usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number },
  localTercero?: Tercero,
) {
  const deletedUser = await resolveTerceroForDelete(id, usuarioData, localTercero);
  await deleteTerceroUseCase(id, deletedUser, getActivityLogOptions());
  await afterTerceroDeleted(id);
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
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

export async function createServicioMutation(servicio: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>) {
  const { servicio: created } = await createServicioUseCase(servicio, getActivityLogOptions());
  await afterServicioCreated(created.id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
}

export async function updateServicioMutation(id: string, updates: Partial<Servicio>) {
  await updateServicioUseCase(id, updates, getActivityLogOptions());
  await afterServicioUpdated(id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
}

export async function deleteServicioMutation(id: string, deletePayments = false) {
  await deleteServicioUseCase(id, {
    deletePayments,
    ...getActivityLogOptions(),
  });
  await afterServicioDeleted(id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
}

export async function refreshServicioProfileCountMutation() {
  await invalidateStoreQueries(['servicios', 'ventas', 'pagination']);
}

export async function createVentaMutation(venta: Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>) {
  const { venta: created } = await createVentaUseCase(venta, getActivityLogOptions());
  await afterVentaCreated(created.id);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'pagination']);
}

export async function updateVentaMutation(id: string, updates: Partial<VentaDoc>) {
  const { serviceProfileDelta } = await updateVentaUseCase(id, updates, getActivityLogOptions());
  await afterVentaUpdated(id, serviceProfileDelta);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'pagination']);
}

export async function deleteVentaMutation(id: string, servicioId?: string, perfilNumero?: number | null, deletePagos = false) {
  const { serviceProfileDelta } = await deleteVentaUseCase(id, {
    servicioId,
    perfilNumero,
    deletePagos,
    ...getActivityLogOptions(),
  });
  await afterVentaDeleted(id, serviceProfileDelta);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'notificaciones', 'pagination']);
}
