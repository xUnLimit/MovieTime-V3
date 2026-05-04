'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Calendar, DollarSign, Mail, Lock, User } from 'lucide-react';
import { TemplateMensaje, TipoTemplate } from '@/types';
import { useTemplatesStore } from '@/store/templatesStore';
import { toast } from 'sonner';

interface TemplateEditorProps {
  templates: TemplateMensaje[];
}

const TIPO_TEMPLATES: { value: TipoTemplate; label: string }[] = [
  { value: 'notificacion_regular', label: 'Notificación Regular' },
  { value: 'dia_pago', label: 'Notificación Día de Pago' },
  { value: 'renovacion', label: 'Notificación de Renovación' },
  { value: 'suscripcion', label: 'Notificación de Suscripción' },
  { value: 'cancelacion', label: 'Cancelación de Servicio' },
];

const PLACEHOLDERS = [
  { key: '{saludo}', description: 'El saludo (Buenos días, tardes, etc.)', icon: User },
  { key: '{cliente}', description: 'El nombre completo del cliente', icon: User },
  { key: '{nombre_cliente}', description: 'El primer nombre del cliente', icon: User },
  { key: '{{#items}}\n...\n{{/items}}', description: 'Bloque repetible por item (escribe el contenido en el medio)', icon: Calendar },
  { key: '{items}', description: 'Lista de servicios en formato: *A*, *B* y *C*', icon: Calendar },
  { key: '{servicio}', description: 'El nombre del servicio', icon: Calendar },
  { key: '{categoria}', description: 'La categoría del servicio', icon: Calendar },
  { key: '{perfil_nombre}', description: 'El nombre del perfil', icon: User },
  { key: '{correo}', description: 'El correo electrónico del servicio', icon: Mail },
  { key: '{contrasena}', description: 'La contraseña del servicio', icon: Lock },
  { key: '{codigo}', description: 'El código de la venta', icon: Lock },
  { key: '{vencimiento}', description: 'La fecha de vencimiento', icon: Calendar },
  { key: '{monto}', description: 'El monto a pagar', icon: DollarSign },
];

export function TemplateEditor({ templates }: TemplateEditorProps) {
  const { updateTemplate, createTemplate } = useTemplatesStore();
  const [selectedTipo, setSelectedTipo] = useState<TipoTemplate>('notificacion_regular');

  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.tipo === selectedTipo) || null;
  }, [selectedTipo, templates]);

  const defaultContenido = currentTemplate?.contenido || '';
  const [contenido, setContenido] = useState(defaultContenido);
  const [lastTipo, setLastTipo] = useState(selectedTipo);

  // Sync when tipo changes (not when just template updates)
  if (selectedTipo !== lastTipo) {
    setLastTipo(selectedTipo);
    setContenido(defaultContenido);
  }

  const handleCopyPlaceholder = async (placeholder: string) => {
    try {
      await navigator.clipboard.writeText(placeholder);
      toast.success('Placeholder copiado', { description: 'El placeholder ha sido copiado al portapapeles.' });
    } catch (error) {
      toast.error('Error al copiar', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleSave = async () => {
    try {
      // Detect placeholders in content
      const detectedPlaceholders = PLACEHOLDERS
        .map((p) => p.key)
        .filter((placeholder) => contenido.includes(placeholder));

      if (currentTemplate) {
        // Update existing template
        await updateTemplate(currentTemplate.id, {
          contenido,
          placeholders: detectedPlaceholders,
        });
        toast.success('Plantilla actualizada', { description: 'Los cambios en la plantilla han sido guardados correctamente.' });
      } else {
        // Create new template
        const tipoLabel = TIPO_TEMPLATES.find((t) => t.value === selectedTipo)?.label || selectedTipo;
        await createTemplate({
          nombre: tipoLabel,
          tipo: selectedTipo,
          contenido,
          placeholders: detectedPlaceholders,
          activo: true,
        });
        toast.success('Plantilla creada', { description: 'La nueva plantilla de mensaje ha sido creada correctamente.' });
      }
    } catch (error) {
      toast.error('Error al guardar plantilla', { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={selectedTipo} onValueChange={(value) => setSelectedTipo(value as TipoTemplate)}>
        <TabsList className="justify-start rounded-none h-auto p-0 bg-transparent w-fit border-b">
          {TIPO_TEMPLATES.map((tipo) => (
            <TabsTrigger
              key={tipo.value}
              value={tipo.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              {tipo.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIPO_TEMPLATES.map((tipo) => (
          <TabsContent key={tipo.value} value={tipo.value} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Editor Section */}
              <Card className="lg:col-span-2 p-5 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">Plantilla de {tipo.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    Edita el mensaje para notificar sobre vencimientos próximos.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Contenido del Mensaje</label>
                  <div className="relative">
                    <Textarea
                      value={contenido}
                      onChange={(e) => setContenido(e.target.value)}
                      placeholder="Escribe aquí el contenido del mensaje..."
                      className="h-[320px] text-sm leading-normal resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} size="sm">
                    Guardar Plantilla
                  </Button>
                </div>
              </Card>

              {/* Placeholders Section */}
              <Card className="p-5">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">Placeholders Disponibles</h3>
                    <p className="text-sm text-muted-foreground">
                      Usa estos placeholders en tu mensaje. Serán reemplazados por los valores reales.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PLACEHOLDERS.map((placeholder) => {
                      const Icon = placeholder.icon;
                      return (
                        <div
                          key={placeholder.key}
                          className="p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <code className="text-xs font-semibold block text-foreground">
                                  {placeholder.key}
                                </code>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                                  {placeholder.description}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyPlaceholder(placeholder.key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
