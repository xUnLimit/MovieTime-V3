import {
  createGastoUseCase,
  deleteGastoUseCase,
  updateGastoUseCase,
} from '@/lib/use-cases/gastos-use-cases';
import { invalidateStoreQueries } from '@/lib/cache/store-query-invalidation';
import type { Gasto } from '@/types';

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
