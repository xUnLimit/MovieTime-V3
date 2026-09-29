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
import { ApiSection } from './ApiSection';
import { ApiTab } from './ApiTab';
import { ChannelChip } from './ChannelStatus';
import { tipoCuando, tipoLabel } from './editor-constants';
import { MessageComposer } from './MessageComposer';
import { SaveBar } from './SaveBar';
import { TemplateList } from './TemplateList';
import { TemplatePreview, type PreviewMode } from './TemplatePreview';
import { useTemplateDraft } from './useTemplateDraft';
import { useTemplateSave } from './useTemplateSave';

interface TemplateEditorProps {
  templates: TemplateMensaje[];
  onTemplateSaved?: () => void | Promise<void>;
}

export function TemplateEditor({ templates, onTemplateSaved }: TemplateEditorProps) {
  const [selectedTipo, setSelectedTipo] = useState<EditableTipoKey>('dia_pago');
  const [pendingTipo, setPendingTipo] = useState<EditableTipoKey | null>(null);
  const [apiOpen, setApiOpen] = useState<Partial<Record<EditableTipoKey, boolean>>>({});
  const [previewMode, setPreviewMode] = useState<PreviewMode>('api');
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

  // Abierta por defecto solo si el mensaje ya tiene plantilla vinculada; luego manda lo que elija la persona.
  const apiSectionOpen = apiOpen[selectedTipo] ?? Boolean(fields.metaTemplateName);
  const changeApiOpen = (open: boolean) => {
    setApiOpen((current) => ({ ...current, [selectedTipo]: open }));
  };

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_348px]">
      <div className="min-w-0 md:col-start-1 md:row-span-2 md:row-start-1 xl:row-span-1">
        <TemplateList selected={selectedTipo} statusOf={statusOf} onSelect={changeTipo} />
      </div>

      <div className="min-w-0 md:col-start-2 md:row-start-1">
        <Card className="min-w-0 gap-0 overflow-clip py-0">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{tipoLabel(selectedTipo)}</h2>
              <p className="text-xs text-muted-foreground">Cuándo se envía: {tipoCuando(selectedTipo)}.</p>
            </div>
            <ChannelChip status={channelStatus(fields.metaTemplateName, metaTemplates)} />
          </header>

          <div className="space-y-4 p-4">
            <MessageComposer tipo={selectedTipo} value={fields.contenido} onChange={(contenido) => patch({ contenido })} />
            <ApiSection status={channelStatus(fields.metaTemplateName, metaTemplates)} open={apiSectionOpen} onOpenChange={changeApiOpen}>
              <ApiTab templates={metaTemplates} fields={fields} mapError={mapError} isLoading={metaLoading} onChange={patch} />
            </ApiSection>
          </div>

          <SaveBar
            dirty={dirty}
            invalid={Boolean(mapError)}
            saving={saving}
            justSaved={justSaved && !dirty}
            onSave={() => save({ tipo: selectedTipo, current: currentTemplate, fields, linked, mapError, onSaved: onTemplateSaved })}
          />
        </Card>
      </div>

      <div className="min-w-0 md:col-start-2 md:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1 xl:self-start">
        <Card className="p-4">
          <TemplatePreview
            contenido={fields.contenido}
            meta={linked}
            paramMap={fields.metaParamMap}
            mode={previewMode}
            onModeChange={setPreviewMode}
          />
        </Card>
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
    </div>
  );
}
