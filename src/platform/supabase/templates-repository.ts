import { getAll, create, update } from './record-core';
import { ENTITIES } from './entities';

export const getTemplates = <T>() => getAll<T>(ENTITIES.TEMPLATES);
export const createTemplate = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TEMPLATES, normalizeTemplateWrite(payload as Record<string, unknown>) as Omit<T, 'id'>);
export const updateTemplate = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TEMPLATES, id, normalizeTemplateWrite(payload as Record<string, unknown>) as Partial<T>);

function normalizeTemplateWrite(payload: Record<string, unknown>) {
  const { placeholders: _placeholders, ...templatePayload } = payload;
  void _placeholders;
  // meta_button_actions es jsonb (arreglo por indice de boton): nunca se escribe algo que no sea arreglo.
  if (templatePayload.metaButtonActions !== undefined && !Array.isArray(templatePayload.metaButtonActions)) {
    templatePayload.metaButtonActions = [];
  }
  return templatePayload;
}
