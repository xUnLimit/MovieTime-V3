import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createTemplateMutation, updateTemplateMutation } from '@/application/client-domain-mutations';
import { resizeButtonActions } from '@/modules/messaging/button-actions';
import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';
import type { TemplateMensaje, TipoTemplate } from '@/types';
import { PLACEHOLDERS, tipoLabel } from './editor-constants';
import type { TemplateFields } from './useTemplateDraft';

type SaveArgs = {
  tipo: TipoTemplate;
  current: TemplateMensaje | null;
  fields: TemplateFields;
  linked: MetaTemplateInfo | null;
  mapError: string | null;
  onSaved?: () => void | Promise<void>;
};

export function useTemplateSave() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const save = async ({ tipo, current, fields, linked, mapError, onSaved }: SaveArgs) => {
    if (mapError) {
      toast.error('Revisa la plantilla de Meta', { description: mapError });
      return;
    }
    const { contenido, metaTemplateName, metaParamMap, metaButtonActions } = fields;
    const detected = PLACEHOLDERS.map((p) => p.key).filter((placeholder) => contenido.includes(placeholder));
    const actions = linked ? resizeButtonActions(metaButtonActions, linked.buttons.length) : metaButtonActions;
    const metaLink = { metaTemplateName, metaParamMap, metaButtonActions: metaTemplateName ? actions : [] };

    setSaving(true);
    try {
      if (current) {
        await updateTemplateMutation(current.id, { contenido, placeholders: detected, ...metaLink }, current);
      } else {
        await createTemplateMutation({
          nombre: tipoLabel(tipo), tipo, contenido, placeholders: detected, activo: true, ...metaLink,
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      await onSaved?.();
      setJustSaved(true);
      toast.success(current ? 'Mensaje actualizado' : 'Mensaje creado', { description: 'Los cambios quedaron guardados.' });
    } catch (error) {
      toast.error('Error al guardar el mensaje', { description: getPublicErrorMessage(error, 'No se pudo guardar el mensaje.') });
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, justSaved, resetSaved: () => setJustSaved(false) };
}
