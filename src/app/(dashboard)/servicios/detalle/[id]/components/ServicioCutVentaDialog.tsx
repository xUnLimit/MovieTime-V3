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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VentaDoc } from '@/types';

import { getVentaEstadoDisplay } from './servicio-sale-actions-helpers';

interface CutVentaDialogProps {
  isSubmitting: boolean;
  open: boolean;
  venta: VentaDoc | null;
  onConfirm: (motivoCorte: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function CutVentaDialog({
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  venta,
}: CutVentaDialogProps) {
  const [motivoCorte, setMotivoCorte] = useState('');

  const handleConfirm = async () => {
    const motivo = motivoCorte.trim();
    if (!motivo) return;
    await onConfirm(motivo);
  };
  const estado = getVentaEstadoDisplay(venta);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="bg-muted/20 px-5 pb-4 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Scissors className="h-4 w-4 text-muted-foreground" />
              </span>
              Cortar - Venta
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{venta?.clienteNombre ?? 'Cliente'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Servicio</span>
              <span className="font-medium">{venta?.servicioNombre ?? 'Servicio'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline" className={`w-fit text-xs font-normal ${estado.className}`}>
                {estado.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo-corte">Motivo de corte</Label>
            <Textarea
              id="motivo-corte"
              value={motivoCorte}
              onChange={(event) => setMotivoCorte(event.target.value)}
              placeholder="Escribe el motivo del corte..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 px-5 pb-5 pt-0 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || motivoCorte.trim().length === 0}
            className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
          >
            {isSubmitting ? 'Cortando...' : 'Cortar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
