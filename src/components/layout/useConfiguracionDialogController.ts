"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useConfig } from "@/hooks/use-config";
import {
  getPushSubscriptionStatus,
  registerPushSubscription,
  triggerExecutivePushTest,
  unregisterPushSubscription,
} from "@/lib/pwa/push-client";
import {
  getExecutivePushBlocksUpdate,
  getExecutivePushScheduleUpdate,
  getExecutivePushToggleUpdate,
  isExecutivePushScheduleUnchanged,
} from "@/lib/executive-push/executive-push-settings";
import { safeAsyncSideEffect } from "@/lib/utils/safety";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { useDashboardFilterStore } from "@/store/dashboardFilterStore";
import { usePwaStore } from "@/store/pwaStore";
import {
  getAvailableDashboardYears,
  getExecutivePushStatus,
} from "./configuracion-dialog-controller-helpers";

interface UseConfiguracionDialogControllerParams {
  open: boolean;
}

export function useConfiguracionDialogController({
  open,
}: UseConfiguracionDialogControllerParams) {
  const user = useAuthStore((state) => state.user);
  const { data: stats } = useDashboardStats();
  const { selectedYear, setSelectedYear } = useDashboardFilterStore();
  const { data: config, refetch: refetchConfig } = useConfig();
  const { updateExecutivePush } = useConfigStore();
  const {
    isInstalled,
    isOnline,
    isPushSupported,
    isOfflineReady,
    lastSyncAt,
    syncStatus,
    syncProgress,
    notificationPermission,
    hydrateOfflineState,
    setNotificationPermission,
    syncOfflineData,
  } = usePwaStore();

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSavingExecutiveSchedule, setIsSavingExecutiveSchedule] = useState(false);
  const [draftWindowStart, setDraftWindowStart] = useState('');
  const [draftWindowEnd, setDraftWindowEnd] = useState('');
  const [draftIntervalHours, setDraftIntervalHours] = useState<number | null>(null);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  useEffect(() => {
    if (!open) return;
    safeAsyncSideEffect(refetchConfig(), {
      operation: 'fetchConfig',
      entity: 'config',
    });
    safeAsyncSideEffect(hydrateOfflineState(), {
      operation: 'hydrateOfflineState',
      entity: 'pwa',
    });
    safeAsyncSideEffect(
      getPushSubscriptionStatus().then((status) => {
        setPushSubscribed(status.subscribed);
        setNotificationPermission(status.permission);
      }),
      { operation: 'getPushSubscriptionStatus', entity: 'pwa' },
    );
  }, [open, refetchConfig, hydrateOfflineState, setNotificationPermission]);

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

  const handleOfflineRefresh = async () => {
    try {
      await syncOfflineData();
      toast.success('Copia offline actualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la copia offline.');
    }
  };

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
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la suscripcion push.');
    }
  };

  const handleExecutivePushToggle = async (enabled: boolean) => {
    if (!executivePush) return;
    try {
      await updateExecutivePush(getExecutivePushToggleUpdate(executivePush, enabled, user?.id), executivePush);
      await refetchConfig();
      toast.success('Configuracion de push ejecutiva actualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la configuracion.');
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
      await updateExecutivePush(getExecutivePushScheduleUpdate({
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
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la programacion.');
    } finally {
      setIsSavingExecutiveSchedule(false);
    }
  };

  const handleTestPush = async () => {
    if (!executivePush?.enabled) {
      toast.error('Activa primero los recordatorios ejecutivos.');
      return;
    }
    setIsSendingTestPush(true);
    try {
      const result = await triggerExecutivePushTest();
      if (result.skipped) {
        toast.info(`Push omitida: ${result.skipped}.`);
      } else if (result.sent > 0) {
        toast.success(`Push de prueba enviada a ${result.sent} dispositivo${result.sent === 1 ? '' : 's'}.`);
      } else {
        toast.warning('Push procesada sin entregas. Verifica las suscripciones activas.');
      }
      // Refresh config so the "last sent" indicator reflects the test send.
      safeAsyncSideEffect(refetchConfig(), {
        operation: 'fetchConfigAfterPushTest',
        entity: 'config',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la push de prueba.');
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleBlockToggle = async (blockKey: string, checked: boolean) => {
    if (!executivePush) return;
    try {
      await updateExecutivePush(getExecutivePushBlocksUpdate({
        blockKey,
        checked,
        executivePush,
        updatedBy: user?.id,
      }), executivePush);
      await refetchConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar los bloques.');
    }
  };
  return {
    selectedYear,
    setSelectedYear,
    availableYears,
    isInstalled,
    isOnline,
    isPushSupported,
    isOfflineReady,
    lastSyncAt,
    syncStatus,
    syncProgress,
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
    handleOfflineRefresh,
    handlePushSubscriptionToggle,
    handleExecutivePushToggle,
    handleScheduleCommit,
    handleTestPush,
    handleBlockToggle,
  };
}
