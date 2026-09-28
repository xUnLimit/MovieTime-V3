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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaTemplates } from '@/hooks/use-templates';
import { channelStatus, validateParamMap } from '@/modules/messaging/meta-template-mapping';
import type { EditableTipoKey } from '@/modules/messaging/template-tipos';
import type { TemplateMensaje } from '@/types';
import { ApiTab } from './ApiTab';
import { ChannelChip } from './ChannelStatus';
import { tipoCuando, tipoLabel } from './editor-constants';
import { MessageTab } from './MessageTab';
import { SaveBar } from './SaveBar';
import { TemplateList } from './TemplateList';
import { TemplatePreview, type PreviewMode } from './TemplatePreview';
import { useTemplateDraft } from './useTemplateDraft';
import { useTemplateSave } from './useTemplateSave';

interface TemplateEditorProps {
  templates: TemplateMensaje[];
  onTemplateSaved?: () => void | Promise<void>;
}

type InnerTab = 'mensaje' | 'api';

export function TemplateEditor({ templates, onTemplateSaved }: TemplateEditorProps) {
  const [selectedTipo, setSelectedTipo] = useState<EditableTipoKey>('dia_pago');
  const [pendingTipo, setPendingTipo] = useState<EditableTipoKey | null>(null);
  const [innerTab, setInnerTab] = useState<InnerTab>('mensaje');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('wame');
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

  const changeInnerTab = (value: string) => {
    const tab = value as InnerTab;
    setInnerTab(tab);
    setPreviewMode(tab === 'api' ? 'api' : 'wame');
  };

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_320px]">
      <div className="min-w-0 md:col-start-1 md:row-span-2 md:row-start-1 xl:row-span-1">
        <TemplateList selected={selectedTipo} statusOf={statusOf} onSelect={changeTipo} />
      </div>

      <div className="min-w-0 space-y-4 md:col-start-2 md:row-start-1">
        <Card className="min-w-0 space-y-4 p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{tipoLabel(selectedTipo)}</h2>
              <p className="text-sm text-muted-foreground">Cuándo se envía: {tipoCuando(selectedTipo)}.</p>
            </div>
            <ChannelChip status={channelStatus(fields.metaTemplateName, metaTemplates)} />
          </header>

          <Tabs value={innerTab} onValueChange={changeInnerTab}>
            <TabsList>
              <TabsTrigger value="mensaje">Mensaje</TabsTrigger>
              <TabsTrigger value="api">WhatsApp API</TabsTrigger>
            </TabsList>
            <TabsContent value="mensaje" className="pt-3">
              <MessageTab tipo={selectedTipo} value={fields.contenido} onChange={(contenido) => patch({ contenido })} />
            </TabsContent>
            <TabsContent value="api" className="pt-3">
              <ApiTab templates={metaTemplates} fields={fields} mapError={mapError} isLoading={metaLoading} onChange={patch} />
            </TabsContent>
          </Tabs>
        </Card>

        <SaveBar
          dirty={dirty}
          invalid={Boolean(mapError)}
          saving={saving}
          justSaved={justSaved && !dirty}
          onSave={() => save({ tipo: selectedTipo, current: currentTemplate, fields, linked, mapError, onSaved: onTemplateSaved })}
        />
      </div>

      <div className="min-w-0 md:col-start-2 md:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1 xl:self-start">
        <Card className="p-5">
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
