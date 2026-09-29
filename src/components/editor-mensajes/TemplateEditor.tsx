'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { useMetaTemplates } from '@/hooks/use-templates';
import { channelStatus, validateParamMap } from '@/modules/messaging/meta-template-mapping';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import type { TemplateMensaje } from '@/types';
import { ApiTab } from './ApiTab';
import { tipoCuando, tipoLabel } from './editor-constants';
import { MessageComposer } from './MessageComposer';
import { MethodSwitch, type SendMode } from './MethodSwitch';
import { PanelHeader } from './PanelFrame';
import { SaveBar } from './SaveBar';
import { TemplateList } from './TemplateList';
import { TemplatePreview } from './TemplatePreview';
import { useTemplateDraft } from './useTemplateDraft';
import { useTemplateSave } from './useTemplateSave';

interface TemplateEditorProps {
  templates: TemplateMensaje[];
  onTemplateSaved?: () => void | Promise<void>;
}

export function TemplateEditor({ templates, onTemplateSaved }: TemplateEditorProps) {
  const [selectedTipo, setSelectedTipo] = useState<EditableTipoKey>('dia_pago');
  const [pendingTipo, setPendingTipo] = useState<EditableTipoKey | null>(null);
  const [modes, setModes] = useState<Partial<Record<EditableTipoKey, SendMode>>>({});
  const { data: metaTemplates = [], isLoading: metaLoading } = useMetaTemplates();
  const { save, saving, justSaved, resetSaved } = useTemplateSave();

  const currentTemplate = templates.find((t) => t.tipo === selectedTipo) ?? null;
  const { fields, dirty, patch } = useTemplateDraft(selectedTipo, currentTemplate);

  const linked = fields.metaTemplateName
    ? metaTemplates.find((item) => item.name === fields.metaTemplateName && !item.retired) ?? null
    : null;
  const mapError = validateParamMap(fields.metaParamMap, linked);
  const statusOf = (tipo: EditableTipoKey) =>
    channelStatus(templates.find((t) => t.tipo === tipo)?.metaTemplateName, metaTemplates);

  const changeTipo = (tipo: EditableTipoKey) => {
    if (tipo === selectedTipo) return;
    if (dirty) setPendingTipo(tipo);
    else {
      resetSaved();
      setSelectedTipo(tipo);
    }
  };

  const confirmSwitch = () => {
    if (pendingTipo) setSelectedTipo(pendingTipo);
    resetSaved();
    setPendingTipo(null);
  };

  // Sin eleccion previa, un mensaje con plantilla vinculada abre en Automatico y el resto en Manual; luego manda la persona.
  const status = channelStatus(fields.metaTemplateName, metaTemplates);
  const mode = modes[selectedTipo] ?? (fields.metaTemplateName ? 'api' : 'wame');
  const changeMode = (next: SendMode) => {
    setModes((current) => ({ ...current, [selectedTipo]: next }));
  };

  return (
    <Card className="grid min-w-0 gap-0 overflow-clip py-0 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_332px]">
      <div className="min-w-0 border-b md:col-start-1 md:row-span-2 md:row-start-1 md:border-b-0 md:border-r xl:row-span-1">
        <TemplateList selected={selectedTipo} statusOf={statusOf} onSelect={changeTipo} />
      </div>

      <div className="flex min-h-[30rem] min-w-0 flex-col md:col-start-2 md:row-start-1">
        <PanelHeader
          title={<span className="text-base">{tipoLabel(selectedTipo)}</span>}
          description={`Cuándo se envía: ${tipoCuando(selectedTipo)}.`}
          actions={<MethodSwitch mode={mode} status={status} onChange={changeMode} />}
        />

        <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
          {mode === 'wame' ? (
            <MessageComposer tipo={selectedTipo} value={fields.contenido} onChange={(contenido) => patch({ contenido })} />
          ) : (
            <ApiTab templates={metaTemplates} fields={fields} mapError={mapError} isLoading={metaLoading} onChange={patch} />
          )}
        </div>

        <SaveBar
          dirty={dirty}
          invalid={Boolean(mapError)}
          saving={saving}
          justSaved={justSaved && !dirty}
          onSave={() => save({ tipo: selectedTipo, current: currentTemplate, fields, linked, mapError, onSaved: onTemplateSaved })}
        />
      </div>

      <div className="min-w-0 border-t md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1 xl:border-l xl:border-t-0">
        <TemplatePreview contenido={fields.contenido} meta={linked} paramMap={fields.metaParamMap} mode={mode} />
      </div>

      <AlertDialog open={pendingTipo !== null} onOpenChange={(open) => { if (!open) setPendingTipo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si cambias de mensaje ahora, se pierden los cambios de «{tipoLabel(selectedTipo)}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>Descartar y cambiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
