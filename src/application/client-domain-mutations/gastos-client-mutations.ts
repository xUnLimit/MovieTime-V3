import {
  createGastoUseCase,
  deleteGastoUseCase,
  updateGastoUseCase,
} from '@/application/use-cases/gastos-use-cases';
import {
  afterGastoCreated,
  afterGastoDeleted,
  afterGastoUpdated,
} from '@/application/store-reactions/gastos-mutation-reactions';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { Gasto } from '@/types';

export async function createGastoMutation(
  gasto: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'tipoGastoNombre'>,
) {
  const { gasto: created } = await createGastoUseCase(gasto);
  await afterGastoCreated(created);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
}

export async function updateGastoMutation(
  id: string,
  updates: Partial<Omit<Gasto, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const result = await updateGastoUseCase(id, updates);
  await afterGastoUpdated(result);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
}

export async function deleteGastoMutation(id: string) {
  const { gasto } = await deleteGastoUseCase(id);
  await afterGastoDeleted(gasto);
  await invalidateStoreQueries(['gastos', 'tiposGasto', 'dashboard', 'pagination']);
}
