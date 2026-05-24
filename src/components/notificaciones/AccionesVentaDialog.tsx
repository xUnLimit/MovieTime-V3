/**
 * AccionesVentaDialog Component
 *
 * Modal de acciones para notificaciones de ventas según diseño v2.1.
 */

'use client';

import { useEffect, useState } from 'react';
import { Scissors, Star, X } from 'lucide-react';

import { AccionesVentaDialogOption } from './AccionesVentaDialogOption';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { NotificacionVenta } from '@/types/notificaciones';

type AccionVenta = 'cortar' | 'resaltar' | 'descartar';

interface AccionesVentaDialogProps {
  notificacion: (NotificacionVenta & { id: string }) | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCortar: (motivoCorte: string) => Promise<void>;
  onResaltar: () => Promise<void>;
  onDescartar: () => Promise<void>;
}

function getEstadoVentaDisplay(diasRestantes: number) {
  const dangerClass = 'border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400';

  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return {
      className: dangerClass,
      text: `${dias} día${dias !== 1 ? 's' : ''} vencida`,
    };
  }

  if (diasRestantes === 0) {
    return {
      className: dangerClass,
      text: 'Vence hoy',
    };
  }

  if (diasRestantes <= 3) {
    return {
      className: 'border-orange-500/40 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
      text: `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`,
    };
  }

  return {
    className: 'border-yellow-500/40 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    text: `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`,
  };
}

export function AccionesVentaDialog({
  notificacion,
  isOpen,
  onOpenChange,
  onCortar,
  onResaltar,
  onDescartar,
}: AccionesVentaDialogProps) {
  const [accion, setAccion] = useState<AccionVenta>('resaltar');
  const [motivoCorte, setMotivoCorte] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const yaResaltada = notificacion?.resaltada ?? false;

  useEffect(() => {
    setAccion(yaResaltada ? 'cortar' : 'resaltar');
    setMotivoCorte('');
  }, [notificacion?.id, yaResaltada]);

  if (!notificacion) return null;

  const estado = getEstadoVentaDisplay(notificacion.diasRestantes);

  const resetState = () => {
    setAccion(yaResaltada ? 'cortar' : 'resaltar');
    setMotivoCorte('');
  };

  const handleConfirmar = async () => {
    if (accion === 'cortar' && motivoCorte.trim().length === 0) return;
    setIsSubmitting(true);
    try {
      if (accion === 'cortar') {
        await onCortar(motivoCorte.trim());
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
      resetState();
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      resetState();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden gap-0">
        <div className="px-6 pt-6 pb-4 bg-muted/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted">
                <Scissors className="h-4 w-4 text-muted-foreground" />
              </div>
              {'Cortar — Venta'}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Cliente</span>
              <span className="font-medium">{notificacion.clienteNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Servicio</span>
              <span className="font-medium">{notificacion.servicioNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Estado</span>
              <Badge variant="outline" className={`text-xs font-normal ${estado.className}`}>
                {estado.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">¿Qué acción deseas realizar?</p>
            <RadioGroup
              value={accion}
              onValueChange={(value) => setAccion(value as AccionVenta)}
              className="space-y-2"
            >
              <AccionesVentaDialogOption
                checked={accion === 'cortar'}
                description="Inactivar venta + liberar perfil + eliminar notificación"
                icon={<Scissors className="h-3.5 w-3.5 text-orange-600" />}
                id={yaResaltada ? 'opt-cortar-r' : 'opt-cortar'}
                title="Cortar venta ahora"
                tone="orange"
                value="cortar"
              />

              {yaResaltada ? (
                <AccionesVentaDialogOption
                  checked={accion === 'descartar'}
                  description="Quita el resaltado naranja, la notificación vuelve a su estado normal"
                  icon={<X className="h-3.5 w-3.5 text-blue-500" />}
                  id="opt-descartar"
                  title="Descartar resaltado"
                  tone="blue"
                  value="descartar"
                />
              ) : (
                <AccionesVentaDialogOption
                  checked={accion === 'resaltar'}
                  description="Marca la notificación en naranja para no perderla de vista"
                  icon={<Star className="h-3.5 w-3.5 text-yellow-500" />}
                  id="opt-resaltar"
                  title="Resaltar para seguimiento"
                  tone="yellow"
                  value="resaltar"
                />
              )}
            </RadioGroup>

            {accion === 'cortar' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Motivo de corte</p>
                <Textarea
                  value={motivoCorte}
                  onChange={(event) => setMotivoCorte(event.target.value)}
                  placeholder="Escribe el motivo del corte..."
                />
              </div>
            ) : null}
          </div>
        </div>

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
            disabled={isSubmitting || (accion === 'cortar' && motivoCorte.trim().length === 0)}
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
