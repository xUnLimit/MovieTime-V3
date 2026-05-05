'use client';

import { useState } from 'react';
import { TemplateMensaje } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Edit, Trash2, Copy } from 'lucide-react';
import { useTemplatesStore } from '@/store/templatesStore';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

interface TemplatesListProps {
  templates: TemplateMensaje[];
  onEdit: (template: TemplateMensaje) => void;
  onPreview: (template: TemplateMensaje) => void;
}

export function TemplatesList({ templates, onEdit, onPreview }: TemplatesListProps) {
  const { updateTemplate, deleteTemplate } = useTemplatesStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateMensaje | null>(null);

  const handleToggleActive = async (template: TemplateMensaje) => {
    try {
      await updateTemplate(template.id, { activo: !template.activo });
      toast.success(`Template ${template.activo ? 'desactivado' : 'activado'}`, { description: template.activo ? 'El template ha sido desactivado y no se usará en notificaciones.' : 'El template está activo y listo para usarse.' });
    } catch (error) {
      toast.error('Error al actualizar template', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleDelete = (template: TemplateMensaje) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (templateToDelete) {
      try {
        await deleteTemplate(templateToDelete.id);
        toast.success('Template eliminado', { description: 'El template de mensaje ha sido eliminado correctamente.' });
      } catch (error) {
        toast.error('Error al eliminar template', { description: error instanceof Error ? error.message : undefined });
      }
    }
  };

  const handleCopy = async (template: TemplateMensaje) => {
    try {
      await navigator.clipboard.writeText(template.contenido);
      toast.success('Contenido copiado', { description: 'El contenido de la plantilla ha sido copiado al portapapeles.' });
    } catch (error) {
      toast.error('Error al copiar', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const getTipoLabel = (tipo: TemplateMensaje['tipo']) => {
    const labels = {
      notificacion_regular: 'Notificación Regular',
      dia_pago: 'Día de Pago',
      renovacion: 'Renovación',
      suscripcion: 'Suscripción',
      cancelacion: 'Cancelación',
    };
    return labels[tipo];
  };

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay templates disponibles</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="p-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{template.nombre}</h3>
                    <Badge variant="outline">{getTipoLabel(template.tipo)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {template.contenido}
                  </p>
                </div>
                <Switch
                  checked={template.activo}
                  onCheckedChange={() => handleToggleActive(template)}
                />
              </div>

              {template.placeholders.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.placeholders.map((placeholder) => (
                    <Badge key={placeholder} variant="secondary" className="text-xs">
                      {placeholder}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreview(template)}
                  className="flex-1"
                >
                  Vista Previa
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(template)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(template)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Template"
        description={`¿Estás seguro de que quieres eliminar el template "${templateToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
