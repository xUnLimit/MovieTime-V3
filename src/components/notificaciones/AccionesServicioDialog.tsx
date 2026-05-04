'use client';

import { useState, useEffect } from 'react';
import { Scissors, Star, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import type { NotificacionServicio } from '@/types/notificaciones';

interface AccionesServicioDialogProps {
  notificacion: (NotificacionServicio & { id: string }) | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCortar: () => Promise<void>;
  onResaltar: () => Promise<void>;
  onDescartar: () => Promise<void>;
}

export function AccionesServicioDialog({
  notificacion,
  isOpen,
  onOpenChange,
  onCortar,
  onResaltar,
  onDescartar,
}: AccionesServicioDialogProps) {
  const [accion, setAccion] = useState<'cortar' | 'resaltar' | 'descartar'>('resaltar');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const yaResaltada = notificacion?.resaltada ?? false;

  useEffect(() => {
    setAccion(yaResaltada ? 'cortar' : 'resaltar');
  }, [notificacion?.id, yaResaltada]);

  if (!notificacion) return null;

  const diasRestantes = notificacion.diasRestantes;

  const estadoColor =
    diasRestantes < 0
      ? 'border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
      : diasRestantes === 0
        ? 'border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        : diasRestantes <= 3
          ? 'border-orange-500/40 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
          : 'border-yellow-500/40 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400';

  const estadoTexto =
    diasRestantes < 0
      ? `${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''} vencido`
      : diasRestantes === 0
        ? 'Vence hoy'
        : `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`;

  const handleConfirmar = async () => {
    setIsSubmitting(true);
    try {
      if (accion === 'cortar') {
        await onCortar();
      } else if (accion === 'descartar') {
        await onDescartar();
      } else {
        await onResaltar();
      }
      onOpenChange(false);
    } catch {
      // error handled in parent
    } finally {
      setIsSubmitting(false);
      setAccion(yaResaltada ? 'cortar' : 'resaltar');
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setAccion(yaResaltada ? 'cortar' : 'resaltar');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden gap-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-muted/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted">
                <Scissors className="h-4 w-4 text-muted-foreground" />
              </div>
              {'Cortar — Servicio'}
            </DialogTitle>
          </DialogHeader>

          {/* Info del servicio */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Nombre</span>
              <span className="font-medium">{notificacion.servicioNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Correo</span>
              <span className="font-medium">{notificacion.correo}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Estado</span>
              <Badge variant="outline" className={`text-xs font-normal ${estadoColor}`}>
                {estadoTexto}
              </Badge>
            </div>
          </div>
        </div>

        {/* Cuerpo del modal */}
        <div className="px-6 py-4">
          {yaResaltada ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">¿Qué acción deseas realizar?</p>
              <RadioGroup
                value={accion}
                onValueChange={(v) => setAccion(v as 'cortar' | 'descartar')}
                className="space-y-2"
              >
                {/* Opción Cortar */}
                <label
                  htmlFor="opt-cortar-sr"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    accion === 'cortar'
                      ? 'border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem value="cortar" id="opt-cortar-sr" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-sm font-medium">Cortar servicio ahora</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inactivar servicio + eliminar notificación
                    </p>
                  </div>
                </label>

                {/* Opción Descartar resaltado */}
                <label
                  htmlFor="opt-descartar-sr"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    accion === 'descartar'
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem value="descartar" id="opt-descartar-sr" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <X className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-sm font-medium">Descartar resaltado</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quita el resaltado naranja, la notificación vuelve a su estado normal
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">¿Qué acción deseas realizar?</p>
              <RadioGroup
                value={accion}
                onValueChange={(v) => setAccion(v as 'cortar' | 'resaltar')}
                className="space-y-2"
              >
                {/* Opción Cortar */}
                <label
                  htmlFor="opt-cortar-s"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    accion === 'cortar'
                      ? 'border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem value="cortar" id="opt-cortar-s" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-sm font-medium">Cortar servicio ahora</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inactivar servicio + eliminar notificación
                    </p>
                  </div>
                </label>

                {/* Opción Resaltar */}
                <label
                  htmlFor="opt-resaltar-s"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    accion === 'resaltar'
                      ? 'border-yellow-400 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem value="resaltar" id="opt-resaltar-s" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="text-sm font-medium">Resaltar para seguimiento</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marca la notificación en naranja para no perderla de vista
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 pb-5 pt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={isSubmitting}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-transparent"
          >
            {isSubmitting
              ? 'Procesando...'
              : accion === 'cortar'
                ? 'Cortar'
                : accion === 'descartar'
                  ? 'Descartar resaltado'
                  : 'Resaltar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
