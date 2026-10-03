import {
  buildCategorias,
  createCategoriaRecord,
  deleteCategoriaRecord,
  updateCategoriaRecord,
  upsertCategoriaPlanes,
} from '@/platform/supabase/categorias-repository';
import { getCategoriaRead } from '@/platform/supabase/domain-read-adapters';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { detectarCambios } from '@/platform/utils/activityLogHelpers';
import type { ActivityLog, Categoria } from '@/types';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export { getCategoriasFull as fetchCategoriasFull, getCategoriasCounts as fetchCategoriasCounts } from '@/platform/supabase/categorias-repository';

export function getCategoriaReadUseCase(id: string) {
  return getCategoriaRead(id);
}

export async function createCategoriaUseCase(
  categoriaData: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
): Promise<Categoria> {
  const data = await createCategoriaRecord(categoriaData);
  await upsertCategoriaPlanes(data.id, categoriaData.tiposPlanes ?? [], categoriaData.planes ?? []);
  const [newCategoria] = await buildCategorias([data]);

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'creacion',
    entidad: 'categoria',
    entidadId: data.id,
    entidadNombre: categoriaData.nombre,
    detalles: `Categoria creada: "${categoriaData.nombre}"`,
  });

  return newCategoria;
}

export async function updateCategoriaUseCase(
  id: string,
  updates: Partial<Categoria>,
  options: {
    oldCategoria?: Categoria;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
): Promise<Categoria> {
  const data = await updateCategoriaRecord(id, updates);

  if (updates.tiposPlanes || updates.planes) {
    await upsertCategoriaPlanes(
      id,
      updates.tiposPlanes ?? options.oldCategoria?.tiposPlanes ?? [],
      updates.planes ?? options.oldCategoria?.planes ?? []
    );
  }

  const [updatedCategoria] = await buildCategorias([data]);
  const cambios = options.oldCategoria
    ? detectarCambios(
        'categoria',
        options.oldCategoria,
        updatedCategoria
      )
    : [];

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'actualizacion',
    entidad: 'categoria',
    entidadId: id,
    entidadNombre: options.oldCategoria?.nombre ?? id,
    detalles: `Categoria actualizada: "${options.oldCategoria?.nombre}"`,
    cambios: cambios.length > 0 ? cambios : undefined,
  });

  return updatedCategoria;
}

export async function deleteCategoriaUseCase(
  id: string,
  options: {
    categoria?: Categoria;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  await deleteCategoriaRecord(id);

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: 'categoria',
    entidadId: id,
    entidadNombre: options.categoria?.nombre ?? id,
    detalles: `Categoria eliminada: "${options.categoria?.nombre}"`,
  });

  // El use-case es el unico emisor del hecho de dominio.
  storeEventBus.emit({ type: 'CATEGORIA_DELETED', categoriaId: id });
}
