import {
  createTemplate,
  getTemplates,
  removeTemplate,
  updateTemplate,
} from '@/platform/supabase/templates-repository';
import type { TemplateMensaje } from '@/types';

// Sin plantilla de Meta vinculada no hay nada que mapear: el mapa queda vacio.
export function normalizeMetaLink<T extends Partial<TemplateMensaje>>(template: T): T {
  if (template.metaTemplateName === undefined) return template;
  const name = template.metaTemplateName?.trim() || null;
  return { ...template, metaTemplateName: name, metaParamMap: name ? (template.metaParamMap ?? []) : [] };
}

export function fetchTemplatesUseCase() {
  return getTemplates<TemplateMensaje>();
}

export async function createTemplateUseCase(
  templateData: Omit<TemplateMensaje, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const id = await createTemplate(normalizeMetaLink(templateData) as Omit<TemplateMensaje, 'id'>);
  return {
    ...templateData,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateTemplateUseCase(
  id: string,
  updates: Partial<TemplateMensaje>,
) {
  await updateTemplate(id, normalizeMetaLink(updates));
}

export async function deleteTemplateUseCase(id: string) {
  await removeTemplate(id);
}
