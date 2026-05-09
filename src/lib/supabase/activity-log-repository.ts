import { supabase } from './client';
import { getAll, queryDocuments, getCount, create, remove, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';

export { logCacheHit };

export const getActivityLogs = <T>() => getAll<T>(ENTITIES.ACTIVITY_LOG);
export const queryActivityLogs = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.ACTIVITY_LOG, filters);
export const countActivityLogs = (filters: QueryFilter[] = []) => getCount(ENTITIES.ACTIVITY_LOG, filters);
export const createActivityLog = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.ACTIVITY_LOG, payload);
export const removeActivityLog = (id: string) => remove(ENTITIES.ACTIVITY_LOG, id);
export async function removeAllActivityLogs() {
  assertOnlineMutation();
  const { count, error } = await supabase
    .from('activity_log')
    .delete({ count: 'exact' })
    .neq('id', '');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export { ENTITIES } from './entities';
