import {
  getCount,
  getPaginated,
  type PaginationOptions,
} from '@/platform/supabase/pagination';
import { ENTITIES, type CollectionName } from '@/platform/supabase/entities';
import type { FilterOption } from '@/types/pagination';

const PAGINABLE_COLLECTIONS = new Set<string>([
  ENTITIES.TERCEROS,
  ENTITIES.SERVICIOS,
  ENTITIES.ACTIVITY_LOG,
  ENTITIES.VENTAS,
]);

function assertPaginableCollection(collectionName: string): asserts collectionName is CollectionName {
  if (!PAGINABLE_COLLECTIONS.has(collectionName)) {
    throw new Error(`Coleccion paginable no soportada: ${collectionName}`);
  }
}

export async function getPaginatedUseCase<T>(collectionName: string, options: PaginationOptions) {
  assertPaginableCollection(collectionName);
  return getPaginated<T>(collectionName, options);
}

export async function getCountUseCase(collectionName: string, filters: FilterOption[] = []) {
  assertPaginableCollection(collectionName);
  return getCount(collectionName, filters);
}
