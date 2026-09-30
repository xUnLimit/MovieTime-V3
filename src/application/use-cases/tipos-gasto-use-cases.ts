import { countGastos, createTipoGasto, getTipoGastoById, getTiposGasto, removeTipoGasto, updateTipoGasto } from '@/platform/supabase/catalogos-repository';
import type { TipoGasto } from '@/types';

async function assertUniqueNombre(normalizedNombre: string, currentId?: string) {
  const tiposGasto = await getTiposGasto<TipoGasto>();
  const existing = tiposGasto.find(
    (tipo) =>
      tipo.id !== currentId &&
      tipo.nombre.trim().toLowerCase() === normalizedNombre.toLowerCase(),
  );
  if (existing) {
    throw new Error('Ya existe un tipo de gasto con ese nombre');
  }
}

export function getTipoGastoUseCase(id: string) {
  return getTipoGastoById<TipoGasto>(id);
}

export async function createTipoGastoUseCase(
  tipoGastoData: Omit<TipoGasto, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const normalizedNombre = tipoGastoData.nombre.trim();
  if (!normalizedNombre) {
    throw new Error('El nombre del tipo de gasto es obligatorio');
  }

  await assertUniqueNombre(normalizedNombre);

  await createTipoGasto({
    ...tipoGastoData,
    nombre: normalizedNombre,
  } as Omit<TipoGasto, 'id'>);
}

export async function updateTipoGastoUseCase(
  id: string,
  updates: Partial<TipoGasto>,
) {
  const tipoActual = await getTipoGastoById<TipoGasto>(id);
  if (!tipoActual) throw new Error('Tipo de gasto no encontrado');

  const normalizedNombre = updates.nombre?.trim();
  if (normalizedNombre !== undefined && !normalizedNombre) {
    throw new Error('El nombre del tipo de gasto es obligatorio');
  }

  if (normalizedNombre && normalizedNombre.toLowerCase() !== tipoActual.nombre.trim().toLowerCase()) {
    await assertUniqueNombre(normalizedNombre, id);
  }

  const finalUpdates: Partial<TipoGasto> = {
    ...updates,
    ...(normalizedNombre !== undefined ? { nombre: normalizedNombre } : {}),
  };

  await updateTipoGasto(id, finalUpdates);
  return { tipoActual, finalUpdates };
}

export async function deleteTipoGastoUseCase(id: string) {
  const tipo = await getTipoGastoById<TipoGasto>(id);
  if (!tipo) throw new Error('Tipo de gasto no encontrado');

  const gastosAsociados = await countGastos([
    { field: 'tipoGastoId', operator: '==', value: id },
  ]);
  if (gastosAsociados > 0) {
    throw new Error('Este tipo tiene gastos asociados. Inactivalo para conservar el historial.');
  }

  await removeTipoGasto(id);
}
