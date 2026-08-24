'use client';

import { useState } from 'react';
import { Scissors } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import { getEstadoBadge } from './helpers';
import type { NotificacionVentaConId } from './types';

interface CutVentaDialogProps {
  notification: NotificacionVentaConId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCut: (reason: string) => Promise<void>;
}

export function CutVentaDialog({
  notification,
  open,
  onOpenChange,
  onCut,
}: CutVentaDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const status = getEstadoBadge(notification.diasRestantes, false);

  const handleCut = async () => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) return;

    setIsSubmitting(true);
    try {
      await onCut(normalizedReason);
      setReason('');
      onOpenChange(false);
    } catch {
      // The controller reports the error; leaving the dialog open allows retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <Scissors className="h-4 w-4 text-red-600" />
            </span>
            Cortar venta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cliente</span>
              <span className="truncate font-medium">{notification.clienteNombre}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">Servicio</span>
              <span className="truncate font-medium">{notification.servicioNombre}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline" className={status.variant}>{status.text}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cut-reason" className="text-sm font-medium">Motivo de corte</label>
            <Textarea
              id="cut-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Escribe el motivo del corte..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || reason.trim().length === 0}
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleCut}
          >
            {isSubmitting ? 'Procesando...' : 'Cortar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
