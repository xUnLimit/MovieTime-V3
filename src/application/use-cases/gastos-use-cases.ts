import {
  createGasto,
  getGastoById,
  getGastos,
  getTipoGastoById,
  getTiposGasto,
  removeGasto,
  updateGasto,
} from "@/platform/supabase/catalogos-repository";
import type { Gasto, TipoGasto } from "@/types";

// NOTE: este use-case no importa store-reactions (que tocan el store de activity-log).
// Devuelve los datos del resultado y el composition root (gastos-client-mutations)
// dispara el activity-log y la invalidacion de dashboard. Asi la capa de aplicacion
// permanece libre de Zustand.
export type CreateGastoResult = { gasto: Gasto };
export type UpdateGastoResult = {
  gastoId: string;
  gastoAnterior: Gasto;
  gastoActualizado: Gasto;
  shouldInvalidateDashboard: boolean;
};
export type DeleteGastoResult = { gasto: Gasto };

function sortGastos(gastos: Gasto[]) {
  return [...gastos].sort((a, b) => {
    const diff = b.fecha.getTime() - a.fecha.getTime();
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function sortTiposGasto(tiposGasto: TipoGasto[]) {
  return [...tiposGasto].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );
}

export async function fetchGastosUseCase<T = Gasto>() {
  const gastos = await getGastos<Gasto>();
  return sortGastos(gastos) as T[];
}

export async function fetchTiposGastoUseCase<T = TipoGasto>() {
  const tiposGasto = await getTiposGasto<TipoGasto>();
  return sortTiposGasto(tiposGasto) as T[];
}

async function getTipoGastoActivo(tipoGastoId: string): Promise<TipoGasto> {
  const tipoGasto = await getTipoGastoById<TipoGasto>(tipoGastoId);
  if (!tipoGasto) throw new Error('Tipo de gasto no encontrado');
  if (!tipoGasto.activo) throw new Error('El tipo de gasto seleccionado esta inactivo');
  return tipoGasto;
}

async function logBestEffortFailure(promise: Promise<unknown>, operation: string) {
  try {
    await promise;
  } catch (error) {
    console.error(`[GastosUseCase] ${operation} failed`, error);
  }
}

export async function createGastoUseCase(
  gastoData: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'tipoGastoNombre'>,
): Promise<CreateGastoResult> {
  let gastoId: string | null = null;

  try {
    const tipoGasto = await getTipoGastoActivo(gastoData.tipoGastoId);
    const gastoToCreate: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'tipoGastoNombre'> = {
      ...gastoData,
      detalle: gastoData.detalle?.trim() || undefined,
    };

    gastoId = await createGasto(gastoToCreate);

    const newGasto: Gasto = {
      ...gastoData,
      detalle: gastoData.detalle?.trim() || undefined,
      tipoGastoNombre: tipoGasto.nombre,
      id: gastoId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { gasto: newGasto };
  } catch (error) {
    if (gastoId) {
      await logBestEffortFailure(removeGasto(gastoId), 'rollback removeGasto');
    }
    throw error;
  }
}

export async function updateGastoUseCase(
  id: string,
  updates: Partial<Omit<Gasto, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<UpdateGastoResult> {
  const gastoActual = await getGastoById<Gasto>(id);
  if (!gastoActual) throw new Error('Gasto no encontrado');

  const finalUpdates: Partial<Gasto> = {
    ...updates,
    ...(updates.detalle !== undefined ? { detalle: updates.detalle.trim() || undefined } : {}),
  };

  if (updates.tipoGastoId && updates.tipoGastoId !== gastoActual.tipoGastoId) {
    const tipoGasto = await getTipoGastoActivo(updates.tipoGastoId);
    finalUpdates.tipoGastoNombre = tipoGasto.nombre;
  }

  const gastoActualizado: Gasto = {
    ...gastoActual,
    ...finalUpdates,
    updatedAt: new Date(),
  };

  const requiereRecalculoDashboard =
    gastoActual.monto !== gastoActualizado.monto ||
    gastoActual.fecha.getTime() !== gastoActualizado.fecha.getTime();

  const { tipoGastoNombre: _tipoGastoNombre, ...writeUpdates } = finalUpdates;
  void _tipoGastoNombre;
  await updateGasto(id, writeUpdates);

  return {
    gastoId: id,
    gastoAnterior: gastoActual,
    gastoActualizado,
    shouldInvalidateDashboard: requiereRecalculoDashboard,
  };
}

export async function deleteGastoUseCase(id: string): Promise<DeleteGastoResult> {
  const gasto = await getGastoById<Gasto>(id);
  if (!gasto) throw new Error('Gasto no encontrado');

  await removeGasto(id);
  return { gasto };
}
