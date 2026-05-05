'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { TipoGasto } from '@/types';
import { useTiposGastoStore } from '@/store/tiposGastoStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const tipoGastoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'Máximo 80 caracteres'),
  descripcion: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
  activo: z.boolean(),
});

type TipoGastoFormValues = z.infer<typeof tipoGastoSchema>;

interface TipoGastoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoGasto: TipoGasto | null;
}

export function TipoGastoDialog({ open, onOpenChange, tipoGasto }: TipoGastoDialogProps) {
  const { createTipoGasto, updateTipoGasto } = useTiposGastoStore();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TipoGastoFormValues>({
    resolver: zodResolver(tipoGastoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      activo: true,
    },
  });

  const activo = watch('activo');

  useEffect(() => {
    if (tipoGasto) {
      reset({
        nombre: tipoGasto.nombre,
        descripcion: tipoGasto.descripcion ?? '',
        activo: tipoGasto.activo,
      });
      return;
    }

    reset({
      nombre: '',
      descripcion: '',
      activo: true,
    });
  }, [tipoGasto, reset]);

  const onSubmit = async (data: TipoGastoFormValues) => {
    const payload = {
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim() || undefined,
      activo: data.activo,
    };

    try {
      if (tipoGasto) {
        await updateTipoGasto(tipoGasto.id, payload);
        toast.success('Tipo de gasto actualizado', {
          description: 'Los cambios del tipo de gasto fueron guardados correctamente.',
        });
      } else {
        await createTipoGasto(payload);
        toast.success('Tipo de gasto creado', {
          description: 'El tipo de gasto fue registrado correctamente.',
        });
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(tipoGasto ? 'Error al actualizar tipo de gasto' : 'Error al crear tipo de gasto', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tipoGasto ? 'Editar Tipo de Gasto' : 'Nuevo Tipo de Gasto'}</DialogTitle>
          <DialogDescription>
            Crea y organiza los tipos de gasto disponibles para este módulo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register('nombre')} placeholder="Ej: Internet, transporte, nómina" />
            {errors.nombre && <p className="text-sm text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              {...register('descripcion')}
              placeholder="Detalle opcional para identificar el tipo de gasto"
              rows={3}
            />
            {errors.descripcion && <p className="text-sm text-red-500">{errors.descripcion.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Tipo activo</p>
              <p className="text-xs text-muted-foreground">
                Los tipos inactivos no se pueden usar en nuevos gastos.
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={(checked) => setValue('activo', checked, { shouldValidate: true })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : tipoGasto ? 'Guardar cambios' : 'Crear tipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
