import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { useActivityLogStore } from '@/store/activityLogStore';
import type { TemplateMensaje } from '@/types';

function recordTemplateActivityLog({
  accion,
  templateId,
  templateNombre,
  detalles,
  cambios,
}: {
  accion: 'creacion' | 'actualizacion' | 'eliminacion';
  templateId: string;
  templateNombre: string;
  detalles: string;
  cambios?: ReturnType<typeof detectarCambios>;
}) {
  safeAsyncSideEffect(
    useActivityLogStore.getState().addLog({
      ...getStoreLogContext(),
      accion,
      entidad: 'template',
      entidadId: templateId,
      entidadNombre: templateNombre,
      detalles,
      cambios: cambios && cambios.length > 0 ? cambios : undefined,
    }),
    { operation: 'addActivityLog', entity: 'template', entityId: templateId },
  );
}

export async function afterTemplateCreated(template: TemplateMensaje) {
  recordTemplateActivityLog({
    accion: 'creacion',
    templateId: template.id,
    templateNombre: template.nombre,
    detalles: `Template creado: "${template.nombre}" (${template.tipo})`,
  });
}

export async function afterTemplateUpdated({
  templateId,
  oldTemplate,
  updates,
}: {
  templateId: string;
  oldTemplate?: TemplateMensaje;
  updates: Partial<TemplateMensaje>;
}) {
  const cambios = oldTemplate
    ? detectarCambios('template', oldTemplate, { ...oldTemplate, ...updates })
    : [];

  recordTemplateActivityLog({
    accion: 'actualizacion',
    templateId,
    templateNombre: oldTemplate?.nombre ?? templateId,
    detalles: `Template actualizado: "${oldTemplate?.nombre}"`,
    cambios,
  });
}

export async function afterTemplateDeleted(templateId: string, template?: TemplateMensaje) {
  recordTemplateActivityLog({
    accion: 'eliminacion',
    templateId,
    templateNombre: template?.nombre ?? templateId,
    detalles: `Template eliminado: "${template?.nombre}"`,
  });
}
