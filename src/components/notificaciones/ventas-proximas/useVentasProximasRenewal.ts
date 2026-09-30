'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { afterCommit } from '@/platform/errors/mutation-committed-error';
import { reportError } from '@/platform/observability/logger';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';
import { applyNotificationQueryReactions } from '@/application/store-reactions/notification-query-reactions';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import {
  confirmVentaRenewalFromNotificationUseCase as confirmVentaRenewal,
  loadVentaRenewalOptionsUseCase as loadVentaRenewalOptions,
} from '@/application/use-cases/notificaciones/notificaciones-renewal-use-cases';
import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';

import type { NotificacionVentaConId } from './types';
import { showVentaRenewalOutcome } from './venta-renewal-outcome';

interface Params {
  notifSeleccionada: NotificacionVentaConId | null;
  setNotifSeleccionada: (notif: NotificacionVentaConId | null) => void;
  refreshNotificationCaches: () => Promise<void>;
}

// Dialogo de renovacion desde la notificacion: opciones, confirmacion y aviso final.
export function useVentasProximasRenewal({ notifSeleccionada, setNotifSeleccionada, refreshNotificationCaches }: Params) {
  const queryClient = useQueryClient();
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);
  const [isLoadingRenovar, setIsLoadingRenovar] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [metodosPagoTerceros, setMetodosPagoTerceros] = useState<MetodoPago[]>([]);
  const [categoriaPlanes, setCategoriaPlanes] = useState<Plan[]>([]);
  const [servicioTipoSeleccionado, setServicioTipoSeleccionado] = useState<string | undefined>();

  const handleRenovar = async (notif: NotificacionVentaConId) => {
    if (isLoadingRenovar) return;
    setIsLoadingRenovar(true);
    setNotifSeleccionada(notif);
    setCategoriaPlanes([]);
    setServicioTipoSeleccionado(undefined);
    try {
      const renewalOptions = await loadVentaRenewalOptions(notif);
      setCategoriaPlanes(renewalOptions.categoriaPlanes);
      setServicioTipoSeleccionado(renewalOptions.servicioTipoSeleccionado);
      setMetodosPagoTerceros(renewalOptions.metodosPagoTerceros);
      setRenovarDialogOpen(true);
    } finally {
      setIsLoadingRenovar(false);
    }
  };

  const handleConfirmRenovacion = async (data: EnrichedPagoDialogFormData) => {
    if (!notifSeleccionada) return;

    try {
      const outcome = await confirmVentaRenewal({
        data,
        log: getActivityLogOptions(),
        notif: notifSeleccionada,
        refreshNotificationCaches,
      });
      await afterCommit(notifSeleccionada.ventaId, () => applyNotificationQueryReactions(queryClient, outcome));
      if (outcome.warnings.includes('sync_payment_method_failed')) {
        toast.warning('Venta renovada con advertencia', {
          description: 'La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }
      showVentaRenewalOutcome(outcome, notifSeleccionada, enqueueWhatsAppMessages);
      setRenovarDialogOpen(false);
      setNotifSeleccionada(null);
    } catch (error) {
      reportError('VentasProximas', 'Error renovando venta', error);
      if (notifyCommittedMutation(error)) {
        setRenovarDialogOpen(false);
        setNotifSeleccionada(null);
        return;
      }
      toast.error('Error al renovar la venta');
    }
  };

  return {
    categoriaPlanes,
    handleConfirmRenovacion,
    handleRenovar,
    metodosPagoTerceros,
    renovarDialogOpen,
    servicioTipoSeleccionado,
    setRenovarDialogOpen,
  };
}
