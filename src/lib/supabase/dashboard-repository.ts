import { queryDocuments, getCount, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit };

export const countVentas = (filters: QueryFilter[] = []) => getCount(ENTITIES.VENTAS, filters);
export const countUsuarios = (filters: QueryFilter[] = []) => getCount(ENTITIES.USUARIOS, filters);
export const queryActivityLogs = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.ACTIVITY_LOG, filters);

export { ENTITIES } from './entities';
