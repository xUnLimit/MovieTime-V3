import { queryDocuments, getCount, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';
import { getPaginated } from './pagination';

export { logCacheHit };

export const countVentas = (filters: QueryFilter[] = []) => getCount(ENTITIES.VENTAS, filters);
export const countTerceros = (filters: QueryFilter[] = []) => getCount(ENTITIES.TERCEROS, filters);
export const queryRecentActivityLogs = async <T>(limit = 6) => {
  const result = await getPaginated<T>(ENTITIES.ACTIVITY_LOG, {
    pageSize: limit,
    orderByField: 'timestamp',
    orderDirection: 'desc',
  });
  return result.docs;
};
export const queryActivityLogs = <T>(filters: QueryFilter[] = []) =>
  filters.length > 0
    ? queryDocuments<T>(ENTITIES.ACTIVITY_LOG, filters)
    : queryRecentActivityLogs<T>(6);

export { ENTITIES } from './entities';
