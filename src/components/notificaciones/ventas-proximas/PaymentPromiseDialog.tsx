'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Trash2 } from 'lucide-react';

import {
  getPanamaTomorrow,
  isValidPaymentPromiseDate,
} from '@/application/use-cases/notificaciones/payment-promise';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { NotificacionVentaConId } from './types';

interface PaymentPromiseDialogProps {
  notification: NotificacionVentaConId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => Promise<void>;
  onSave: (date: Date) => Promise<void>;
}

export function PaymentPromiseDialog({
  notification,
  open,
  onOpenChange,
  onRemove,
  onSave,
}: PaymentPromiseDialogProps) {
  const minimumDate = getPanamaTomorrow();
  const initialDate = notification.fechaPrometidaPago ?? minimumDate;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasPromise = Boolean(notification.fechaPrometidaPago);
  const selectedDateIsValid = isValidPaymentPromiseDate(selectedDate);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedDate(initialDate);
      setCalendarOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!selectedDateIsValid) return;

    setIsSubmitting(true);
    try {
      await onSave(selectedDate);
      handleOpenChange(false);
    } catch {
      // The controller reports the error; leaving the dialog open allows retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    try {
      await onRemove();
      handleOpenChange(false);
    } catch {
      // The controller reports the error; leaving the dialog open allows retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
              <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </span>
            {hasPromise ? 'Editar promesa' : 'Promesa de pago'}
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
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Fecha prometida</p>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  <CalendarClock className="mr-2 h-4 w-4 text-blue-600" />
                  {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  defaultMonth={selectedDate}
                  selected={selectedDate}
                  disabled={{ before: minimumDate }}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              La fecha debe ser posterior a hoy. La promesa se marcará vencida al día siguiente.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {hasPromise ? (
            <Button
              type="button"
              variant="outline"
              className="border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              disabled={isSubmitting}
              onClick={handleRemove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Quitar promesa
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || !selectedDateIsValid}
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSave}
            >
              {isSubmitting ? 'Guardando...' : hasPromise ? 'Guardar cambios' : 'Guardar promesa'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
