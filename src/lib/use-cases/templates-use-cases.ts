import {
  createTemplate,
  removeTemplate,
  updateTemplate,
} from '@/lib/supabase/templates-repository';
import type { TemplateMensaje } from '@/types';

export async function createTemplateUseCase(
  templateData: Omit<TemplateMensaje, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const id = await createTemplate(templateData as Omit<TemplateMensaje, 'id'>);
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
  await updateTemplate(id, updates);
}

export async function deleteTemplateUseCase(id: string) {
  await removeTemplate(id);
}
