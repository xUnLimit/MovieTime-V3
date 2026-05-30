import {
  afterTemplateCreated,
  afterTemplateDeleted,
  afterTemplateUpdated,
} from '@/lib/store-reactions/templates-mutation-reactions';
import {
  createTemplateUseCase,
  deleteTemplateUseCase,
  updateTemplateUseCase,
} from '@/lib/use-cases/templates-use-cases';
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

export async function deleteTemplateMutation(id: string, template?: TemplateMensaje) {
  await deleteTemplateUseCase(id);
  await afterTemplateDeleted(id, template);
  await invalidateStoreQueries(['templates', 'notificaciones']);
}
