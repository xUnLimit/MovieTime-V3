'use client';

import { useState } from 'react';
import { PowerOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { NotificacionServicio } from '@/types/notificaciones';

interface AccionesServicioDialogProps {
  notificacion: (NotificacionServicio & { id: string }) | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInactivar: () => Promise<void>;
}

export function AccionesServicioDialog({
  notificacion,
  isOpen,
  onOpenChange,
  onInactivar,
}: AccionesServicioDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!notificacion) return null;

  const diasRestantes = notificacion.diasRestantes;
  const estadoColor =
    diasRestantes <= 0
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
      await onInactivar();
      onOpenChange(false);
    } catch {
      // El controlador muestra el error y el diálogo permanece abierto.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="bg-muted/30 px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <PowerOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              Inactivar — Servicio
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Nombre</span>
              <span className="font-medium">{notificacion.servicioNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Correo</span>
              <span className="font-medium">{notificacion.correo}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Estado</span>
              <Badge variant="outline" className={`text-xs font-normal ${estadoColor}`}>
                {estadoTexto}
              </Badge>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
            El servicio se marcará como inactivo y esta notificación se eliminará.
          </div>
        </div>

        <DialogFooter className="flex gap-2 px-6 pb-5 pt-2">
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
            className="flex-1 border-transparent bg-red-600 text-white hover:bg-red-700"
          >
            {isSubmitting ? 'Procesando...' : 'Inactivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
