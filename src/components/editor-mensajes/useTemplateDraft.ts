import { useState } from 'react';

import type { TemplateMensaje, TipoTemplate } from '@/types';

export type TemplateFields = {
  contenido: string;
  metaTemplateName: string | null;
  metaParamMap: string[];
  metaButtonActions: string[];
};

type DraftState = { tipo: TipoTemplate; templateId: string | null; source: TemplateFields; fields: TemplateFields };

function fieldsOf(template: TemplateMensaje | null): TemplateFields {
  return {
    contenido: template?.contenido ?? '',
    metaTemplateName: template?.metaTemplateName ?? null,
    metaParamMap: template?.metaParamMap ?? [],
    metaButtonActions: template?.metaButtonActions ?? [],
  };
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function same(a: TemplateFields, b: TemplateFields) {
  return a.contenido === b.contenido
    && a.metaTemplateName === b.metaTemplateName
    && sameList(a.metaParamMap, b.metaParamMap)
    && sameList(a.metaButtonActions, b.metaButtonActions);
}

/**
 * Borrador local de un tipo. Al cambiar de tipo o llegar datos nuevos del servidor
 * se reinicia, salvo que el usuario ya tenga cambios sin guardar en ese mismo tipo.
 */
export function useTemplateDraft(tipo: TipoTemplate, template: TemplateMensaje | null) {
  const [state, setState] = useState<DraftState>({
    tipo, templateId: null, source: fieldsOf(null), fields: fieldsOf(null),
  });
  const templateId = template?.id ?? null;
  const source = fieldsOf(template);

  let draft = state;
  if (draft.tipo !== tipo || draft.templateId !== templateId || !same(draft.source, source)) {
    const keepEdits = draft.tipo === tipo && !same(draft.fields, draft.source);
    draft = { tipo, templateId, source, fields: keepEdits ? draft.fields : source };
    setState(draft);
  }

  const patch = (changes: Partial<TemplateFields>) =>
    setState((current) => ({ ...current, fields: { ...current.fields, ...changes } }));

  return { fields: draft.fields, dirty: !same(draft.fields, draft.source), patch };
}
