import {
  getCount,
  getPaginated,
  type PaginationOptions,
} from '@/platform/supabase/pagination';
import type { FilterOption } from '@/types/pagination';

export function getPaginatedUseCase<T>(collectionName: string, options: PaginationOptions) {
  return getPaginated<T>(collectionName, options);
}

export function getCountUseCase(collectionName: string, filters: FilterOption[] = []) {
  return getCount(collectionName, filters);
}
