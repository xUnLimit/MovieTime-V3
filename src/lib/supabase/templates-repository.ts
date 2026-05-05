import { getAll, create, update, remove, logCacheHit } from './record-core';
import { ENTITIES } from './entities';

export { logCacheHit };

export const getTemplates = <T>() => getAll<T>(ENTITIES.TEMPLATES);
export const createTemplate = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TEMPLATES, payload);
export const updateTemplate = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TEMPLATES, id, payload);
export const removeTemplate = (id: string) => remove(ENTITIES.TEMPLATES, id);

export { ENTITIES } from './entities';
