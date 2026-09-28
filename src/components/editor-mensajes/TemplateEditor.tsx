'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useMetaTemplates, useSyncMetaTemplates } from '@/hooks/use-templates';
import { validateParamMap } from '@/modules/messaging/meta-template-mapping';
import {
  createTemplateMutation,
  updateTemplateMutation,
} from '@/application/client-domain-mutations';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';
import type { TemplateMensaje, TipoTemplate } from '@/types';
import { PLACEHOLDERS, TEMPLATE_TIPOS } from './editor-constants';
import { MetaTemplateSection } from './MetaTemplateSection';
import { PlaceholdersCard } from './PlaceholdersCard';
import { TemplatePreview } from './TemplatePreview';
import { useTemplateDraft } from './useTemplateDraft';

interface TemplateEditorProps {
  templates: TemplateMensaje[];
  onTemplateSaved?: () => void | Promise<void>;
}

export function TemplateEditor({ templates, onTemplateSaved }: TemplateEditorProps) {
  const queryClient = useQueryClient();
  const [selectedTipo, setSelectedTipo] = useState<TipoTemplate>('notificacion_regular');
  const { data: metaTemplates = [], isLoading: metaLoading } = useMetaTemplates();
  const syncMeta = useSyncMetaTemplates();

  const currentTemplate = useMemo(
    () => templates.find((t) => t.tipo === selectedTipo) || null,
    [selectedTipo, templates],
  );
  const { fields, patch } = useTemplateDraft(selectedTipo, currentTemplate);
  const { contenido, metaTemplateName, metaParamMap } = fields;

  const linkedMeta = metaTemplateName
    ? metaTemplates.find((item) => item.name === metaTemplateName && !item.retired) ?? null
    : null;
  const mapError = validateParamMap(metaParamMap, linkedMeta);

  const handleSync = () => {
    syncMeta.mutate(undefined, {
      onSuccess: ({ count }) => toast.success('Plantillas sincronizadas', { description: `Se actualizaron ${count} plantillas desde Meta.` }),
      onError: (error) => toast.error('No se pudo sincronizar', { description: getPublicErrorMessage(error, 'No se pudo sincronizar con Meta.') }),
    });
  };

  const handleSave = async () => {
    if (mapError) {
      toast.error('Revisa la plantilla de Meta', { description: mapError });
      return;
    }
    try {
      const detectedPlaceholders = PLACEHOLDERS
        .map((p) => p.key)
        .filter((placeholder) => contenido.includes(placeholder));
      const metaLink = { metaTemplateName, metaParamMap };

      if (currentTemplate) {
        await updateTemplateMutation(
          currentTemplate.id,
          { contenido, placeholders: detectedPlaceholders, ...metaLink },
          currentTemplate,
        );
        await queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
        await onTemplateSaved?.();
        toast.success('Plantilla actualizada', { description: 'Los cambios en la plantilla han sido guardados correctamente.' });
      } else {
        const tipoLabel = TEMPLATE_TIPOS.find((t) => t.value === selectedTipo)?.label || selectedTipo;
        await createTemplateMutation({
          nombre: tipoLabel,
          tipo: selectedTipo,
          contenido,
          placeholders: detectedPlaceholders,
          activo: true,
          ...metaLink,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
        await onTemplateSaved?.();
        toast.success('Plantilla creada', { description: 'La nueva plantilla de mensaje ha sido creada correctamente.' });
      }
    } catch (error) {
      toast.error('Error al guardar plantilla', { description: getPublicErrorMessage(error, 'No se pudo guardar la plantilla.') });
    }
  };

  return (
    <div className="min-w-0 overflow-x-hidden">
      <Tabs value={selectedTipo} onValueChange={(value) => setSelectedTipo(value as TipoTemplate)}>
        <div className="tabs-scroll-shell -mx-1 px-1">
          <TabsList className="tabs-scroll-list h-auto rounded-none border-b border-border bg-transparent p-0">
            {TEMPLATE_TIPOS.map((tipo) => (
              <TabsTrigger
                key={tipo.value}
                value={tipo.value}
                className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {tipo.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TEMPLATE_TIPOS.map((tipo) => (
          <TabsContent key={tipo.value} value={tipo.value} className="min-w-0 space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                <Card className="min-w-0 space-y-3 p-5">
                  <div>
                    <h2 className="text-lg font-semibold">Plantilla de {tipo.label}</h2>
                    <p className="text-sm text-muted-foreground">
                      Texto libre del mensaje. Se envía por wa.me o por la API con la ventana de 24 h abierta.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="template-contenido" className="text-sm font-medium">Contenido del Mensaje</label>
                    <Textarea
                      id="template-contenido"
                      value={contenido}
                      onChange={(e) => patch({ contenido: e.target.value })}
                      placeholder="Escribe aquí el contenido del mensaje..."
                      className="h-[320px] text-sm leading-normal resize-none"
                    />
                  </div>

                  <MetaTemplateSection
                    templates={metaTemplates}
                    linkedName={metaTemplateName}
                    paramMap={metaParamMap}
                    mapError={mapError}
                    isLoading={metaLoading}
                    isSyncing={syncMeta.isPending}
                    onSync={handleSync}
                    onChange={(name, map) => patch({ metaTemplateName: name, metaParamMap: map })}
                  />

                  <div className="flex justify-end">
                    <Button onClick={handleSave} size="sm" disabled={Boolean(mapError)}>
                      Guardar Plantilla
                    </Button>
                  </div>
                </Card>

                <Card className="p-5">
                  <TemplatePreview contenido={contenido} meta={linkedMeta} paramMap={metaParamMap} />
                </Card>
              </div>

              <PlaceholdersCard />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
