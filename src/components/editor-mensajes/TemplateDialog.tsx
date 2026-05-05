'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TemplateMensaje } from '@/types';
import { useTemplatesStore } from '@/store/templatesStore';
import { toast } from 'sonner';

const templateSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['notificacion_regular', 'dia_pago', 'renovacion', 'suscripcion', 'cancelacion']),
  contenido: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateMensaje | null;
}

const AVAILABLE_PLACEHOLDERS = [
  '{cliente}',
  '{servicio}',
  '{categoria}',
  '{monto}',
  '{vencimiento}',
  '{correo}',
  '{contrasena}',
  '{dias_retraso}',
  '{fecha_inicio}',
  '{ciclo_pago}',
];

export function TemplateDialog({ open, onOpenChange, template }: TemplateDialogProps) {
  const { createTemplate, updateTemplate } = useTemplatesStore();
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      nombre: '',
      tipo: 'notificacion_regular',
      contenido: '',
    },
  });

  const tipoValue = watch('tipo');
  const contenidoValue = watch('contenido');

  useEffect(() => {
    if (template) {
      reset({
        nombre: template.nombre,
        tipo: template.tipo,
        contenido: template.contenido,
      });
    } else {
      reset({
        nombre: '',
        tipo: 'notificacion_regular',
        contenido: '',
      });
    }
  }, [template, reset]);

  // Detect placeholders in content
  useEffect(() => {
    const placeholders = AVAILABLE_PLACEHOLDERS.filter((placeholder) =>
      contenidoValue.includes(placeholder)
    );
    setDetectedPlaceholders(placeholders);
  }, [contenidoValue]);

  const insertPlaceholder = (placeholder: string) => {
    const currentContent = contenidoValue || '';
    setValue('contenido', currentContent + ' ' + placeholder);
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const templateData = {
        ...data,
        placeholders: detectedPlaceholders,
        activo: template?.activo ?? true,
      };

      if (template) {
        await updateTemplate(template.id, templateData);
        toast.success('Template actualizado', { description: 'Los cambios en el template han sido guardados correctamente.' });
      } else {
        await createTemplate(templateData);
        toast.success('Template creado', { description: 'El nuevo template de mensaje ha sido creado correctamente.' });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Error al guardar template', { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar' : 'Nuevo'} Template de Mensaje
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Template</Label>
              <Input
                id="nombre"
                {...register('nombre')}
                placeholder="Ej: Notificación de Vencimiento"
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={tipoValue}
                onValueChange={(value) => setValue('tipo', value as 'notificacion_regular' | 'dia_pago' | 'renovacion' | 'suscripcion' | 'cancelacion')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notificacion_regular">Notificación Regular</SelectItem>
                  <SelectItem value="dia_pago">Día de Pago</SelectItem>
                  <SelectItem value="renovacion">Renovación</SelectItem>
                  <SelectItem value="suscripcion">Suscripción</SelectItem>
                  <SelectItem value="cancelacion">Cancelación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contenido">Contenido del Mensaje</Label>
            <Textarea
              id="contenido"
              {...register('contenido')}
              placeholder="Escribe el mensaje aquí. Usa placeholders como {cliente}, {servicio}, etc."
              rows={8}
            />
            {errors.contenido && (
              <p className="text-sm text-red-500">{errors.contenido.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Placeholders Disponibles</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
                <Button
                  key={placeholder}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder(placeholder)}
                >
                  {placeholder}
                </Button>
              ))}
            </div>
          </div>

          {detectedPlaceholders.length > 0 && (
            <div className="space-y-2">
              <Label>Placeholders Detectados</Label>
              <div className="flex flex-wrap gap-2">
                {detectedPlaceholders.map((placeholder) => (
                  <Badge key={placeholder} variant="secondary">
                    {placeholder}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
