"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";

import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useConfig } from "@/hooks/use-config";
import {
  getPushSubscriptionStatus,
  registerPushSubscription,
  triggerDevicePushTest,
  unregisterPushSubscription,
} from "@/modules/pwa/push-client";
import {
  getExecutivePushBlocksUpdate,
  getExecutivePushScheduleUpdate,
  getExecutivePushToggleUpdate,
  isExecutivePushScheduleUnchanged,
} from "@/modules/executive-push/executive-push-settings";
import { updateExecutivePushUseCase } from "@/application/use-cases/config-use-cases";
import { safeAsyncSideEffect } from "@/platform/utils/safety";
import { useAuthStore } from "@/store/authStore";
import { useDashboardFilterStore } from "@/store/dashboardFilterStore";
import { usePwaStore } from "@/store/pwaStore";
import { useWhatsAppAutoSettings } from "./useWhatsAppAutoSettings";
import {
  getAvailableDashboardYears,
  getExecutivePushStatus,
} from "./configuracion-controller-helpers";

export function useConfiguracionController() {
  const user = useAuthStore((state) => state.user);
  const { data: stats } = useDashboardStats();
  const { selectedYear, setSelectedYear } = useDashboardFilterStore();
  const { data: config, refetch: refetchConfig } = useConfig();
  const {
    isPushSupported,
    notificationPermission,
    setNotificationPermission,
  } = usePwaStore();

  const whatsappAuto = useWhatsAppAutoSettings(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSavingExecutiveSchedule, setIsSavingExecutiveSchedule] = useState(false);
  const [draftWindowStart, setDraftWindowStart] = useState('');
  const [draftWindowEnd, setDraftWindowEnd] = useState('');
  const [draftIntervalHours, setDraftIntervalHours] = useState<number | null>(null);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  useEffect(() => {
    safeAsyncSideEffect(refetchConfig(), {
      operation: 'fetchConfig',
      entity: 'config',
    });
    safeAsyncSideEffect(
      getPushSubscriptionStatus().then((status) => {
        setPushSubscribed(status.subscribed);
        setNotificationPermission(status.permission);
      }),
      { operation: 'getPushSubscriptionStatus', entity: 'pwa' },
    );
  }, [refetchConfig, setNotificationPermission]);

  const availableYears = useMemo(() => {
    return getAvailableDashboardYears(stats?.ingresosPorMes);
  }, [stats?.ingresosPorMes]);

  const executivePush = config?.executivePush;
  const executivePushConfigReady = Boolean(executivePush);

  const executivePushStatus = useMemo(() => {
    return getExecutivePushStatus(executivePush);
  }, [executivePush]);

  useEffect(() => {
    if (executivePush?.windowStart) {
      setDraftWindowStart(executivePush.windowStart);
    }
    if (executivePush?.windowEnd) {
      setDraftWindowEnd(executivePush.windowEnd);
    }
    if (executivePush?.intervalHours) {
      setDraftIntervalHours(executivePush.intervalHours);
    }
  }, [executivePush?.windowStart, executivePush?.windowEnd, executivePush?.intervalHours]);

  const handlePushSubscriptionToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await registerPushSubscription();
        setPushSubscribed(true);
        setNotificationPermission('granted');
        toast.success('Push web activada en este dispositivo.');
      } else {
        await unregisterPushSubscription();
        setPushSubscribed(false);
        toast.success('Push web desactivada en este dispositivo.');
      }
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'No se pudo actualizar la suscripcion push.'));
    }
  };

  const handleExecutivePushToggle = async (enabled: boolean) => {
    if (!executivePush) return;
    try {
      await updateExecutivePushUseCase(getExecutivePushToggleUpdate(executivePush, enabled, user?.id), executivePush);
      await refetchConfig();
      toast.success('Configuracion de push ejecutiva actualizada.');
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'No se pudo actualizar la configuracion.'));
    }
  };

  const handleScheduleCommit = async (intervalHours?: number) => {
    if (!executivePush) return;
    const windowStart = draftWindowStart || executivePush.windowStart || '08:00';
    const windowEnd = draftWindowEnd || executivePush.windowEnd || '22:00';
    const nextIntervalHours = intervalHours ?? executivePush.intervalHours;

    if (!windowStart || !windowEnd) {
      toast.error('Selecciona una ventana horaria valida.');
      return;
    }
    if (!Number.isInteger(nextIntervalHours) || nextIntervalHours < 1 || nextIntervalHours > 24) {
      toast.error('Selecciona un intervalo valido.');
      return;
    }
    if (isExecutivePushScheduleUnchanged({ executivePush, intervalHours: nextIntervalHours, windowEnd, windowStart })) {
      return;
    }

    setIsSavingExecutiveSchedule(true);
    try {
      await updateExecutivePushUseCase(getExecutivePushScheduleUpdate({
        executivePush,
        intervalHours: nextIntervalHours,
        updatedBy: user?.id,
        windowEnd,
        windowStart,
      }), executivePush);
      await refetchConfig();
      toast.success('Programacion de recordatorios actualizada.');
    } catch (error) {
      setDraftIntervalHours(executivePush.intervalHours);
      toast.error(getPublicErrorMessage(error, 'No se pudo guardar la programacion.'));
    } finally {
      setIsSavingExecutiveSchedule(false);
    }
  };

  const handleTestPush = async () => {
    setIsSendingTestPush(true);
    try {
      await triggerDevicePushTest();
      toast.success('Prueba push enviada a este dispositivo.');
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'No se pudo enviar la push de prueba.'));
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleBlockToggle = async (blockKey: string, checked: boolean) => {
    if (!executivePush) return;
    try {
      await updateExecutivePushUseCase(getExecutivePushBlocksUpdate({
        blockKey,
        checked,
        executivePush,
        updatedBy: user?.id,
      }), executivePush);
      await refetchConfig();
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'No se pudo actualizar los bloques.'));
    }
  };
  return {
    whatsappAuto,
    selectedYear,
    setSelectedYear,
    availableYears,
    isPushSupported,
    notificationPermission,
    pushSubscribed,
    isSavingExecutiveSchedule,
    draftWindowStart,
    setDraftWindowStart,
    draftWindowEnd,
    setDraftWindowEnd,
    draftIntervalHours,
    setDraftIntervalHours,
    isSendingTestPush,
    executivePush,
    executivePushConfigReady,
    executivePushStatus,
    handlePushSubscriptionToggle,
    handleExecutivePushToggle,
    handleScheduleCommit,
    handleTestPush,
    handleBlockToggle,
  };
}
