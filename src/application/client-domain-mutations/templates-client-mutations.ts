import { afterTemplateCreated, afterTemplateUpdated } from '@/application/store-reactions/templates-mutation-reactions';
import { createTemplateUseCase, updateTemplateUseCase } from '@/application/use-cases/templates-use-cases';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { TemplateMensaje } from '@/types';

export async function createTemplateMutation(template: Omit<TemplateMensaje, 'id' | 'createdAt' | 'updatedAt'>) {
  const newTemplate = await createTemplateUseCase(template);
  await afterTemplateCreated(newTemplate);
  await invalidateStoreQueries(['templates', 'notificaciones']);
}

export async function updateTemplateMutation(id: string, updates: Partial<TemplateMensaje>, oldTemplate?: TemplateMensaje) {
  await updateTemplateUseCase(id, updates);
  await afterTemplateUpdated({ templateId: id, oldTemplate, updates });
  await invalidateStoreQueries(['templates', 'notificaciones']);
}
