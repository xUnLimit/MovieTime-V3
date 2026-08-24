'use client';

import { useState } from 'react';
import { MessageSquare, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { NotificacionVentaConId } from './types';

type MessageAction = (notification: NotificacionVentaConId) =>
  | boolean
  | Promise<boolean>;

interface NotifyVentaDialogProps {
  notification: NotificacionVentaConId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotify: MessageAction;
  onCancelMessage: MessageAction;
}

type NotificationChoice = 'expiration' | 'cancellation';

export function NotifyVentaDialog({
  notification,
  open,
  onOpenChange,
  onNotify,
  onCancelMessage,
}: NotifyVentaDialogProps) {
  const [choice, setChoice] = useState<NotificationChoice>('expiration');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setChoice('expiration');
    onOpenChange(nextOpen);
  };

  const handleContinue = async () => {
    setIsSubmitting(true);
    try {
      const succeeded = choice === 'expiration'
        ? await onNotify(notification)
        : await onCancelMessage(notification);

      if (succeeded !== false) handleOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : handleOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle>Notificar a {notification.clienteNombre}</DialogTitle>
          <DialogDescription>
            Selecciona el mensaje que quieres preparar en WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={choice}
          onValueChange={(value) => setChoice(value as NotificationChoice)}
          className="gap-2"
        >
          <label
            htmlFor="notify-expiration"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              choice === 'expiration'
                ? 'border-green-500/60 bg-green-50 dark:bg-green-500/10'
                : 'hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem
              id="notify-expiration"
              value="expiration"
              aria-label="Aviso de pago"
              className="mt-0.5"
            />
            <MessageSquare className="mt-0.5 h-4 w-4 text-green-600" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Aviso de pago</span>
              <span className="block text-xs text-muted-foreground">
                Usa el aviso regular o de día de pago según el vencimiento.
              </span>
            </span>
          </label>

          <label
            htmlFor="notify-cancellation"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              choice === 'cancellation'
                ? 'border-red-500/60 bg-red-50 dark:bg-red-500/10'
                : 'hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem
              id="notify-cancellation"
              value="cancellation"
              aria-label="Cancelación"
              className="mt-0.5"
            />
            <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Cancelación</span>
              <span className="block text-xs text-muted-foreground">
                Prepara el mensaje de cancelación del servicio.
              </span>
            </span>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Volver
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleContinue}>
            {isSubmitting ? 'Preparando...' : 'Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
