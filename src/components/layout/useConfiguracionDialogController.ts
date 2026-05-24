"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import {
  getPushSubscriptionStatus,
  registerPushSubscription,
  triggerExecutivePushTest,
  unregisterPushSubscription,
} from "@/lib/pwa/push-client";
import { getExecutivePushDueStatus } from "@/lib/pwa/push-schedule";
import { safeAsyncSideEffect } from "@/lib/utils/safety";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { useDashboardFilterStore } from "@/store/dashboardFilterStore";
import { usePwaStore } from "@/store/pwaStore";

interface UseConfiguracionDialogControllerParams {
  open: boolean;
}

export function useConfiguracionDialogController({
  open,
}: UseConfiguracionDialogControllerParams) {
  const user = useAuthStore((state) => state.user);
  const { data: stats } = useDashboardStats();
  const { selectedYear, setSelectedYear } = useDashboardFilterStore();
  const { config, fetchConfig, updateExecutivePush } = useConfigStore();
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
    safeAsyncSideEffect(fetchConfig(true), {
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
  }, [open, fetchConfig, hydrateOfflineState, setNotificationPermission]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set<number>();

    (stats?.ingresosPorMes ?? []).forEach(({ mes }) => {
      const year = parseInt(mes.split('-')[0], 10);
      if (!isNaN(year) && year <= currentYear) {
        yearsFromData.add(year);
      }
    });

    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [stats?.ingresosPorMes]);

  const executivePush = config?.executivePush;
  const executivePushConfigReady = Boolean(executivePush);

  const executivePushStatus = useMemo(() => {
    if (!executivePush) return null;
    const due = getExecutivePushDueStatus({
      enabled: executivePush.enabled,
      windowStart: executivePush.windowStart,
      windowEnd: executivePush.windowEnd,
      intervalHours: executivePush.intervalHours,
      timezone: executivePush.timezone,
      lastSentAt: executivePush.lastSentAt,
    });

    if (!executivePush.enabled) {
      return { tone: 'muted' as const, label: 'Desactivada' };
    }

    if (due.due === false && due.reason === 'invalid_time') {
      return { tone: 'warning' as const, label: 'Ventana invalida' };
    }

    if (due.due === false && due.reason === 'invalid_interval') {
      return { tone: 'warning' as const, label: 'Intervalo invalido' };
    }

    if (executivePush.lastSentAt) {
      const sentAt = executivePush.lastSentAt;
      const timeStr = sentAt.toLocaleTimeString('es-PA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: executivePush.timezone,
      });
      const diffMs = Date.now() - sentAt.getTime();
      const diffMin = Math.max(0, Math.round(diffMs / 60000));
      const ago =
        diffMin < 60 ? `hace ${diffMin} min` : `hace ${Math.round(diffMin / 60)} h`;
      if (due.due === false && due.reason === 'interval_not_elapsed') {
        return { tone: 'muted' as const, label: `Ultimo envio ${timeStr} (${ago})` };
      }
    }

    if (due.due === false && due.reason === 'outside_window') {
      return {
        tone: 'muted' as const,
        label: `Fuera de ventana ${executivePush.windowStart}-${executivePush.windowEnd}`,
      };
    }

    return { tone: 'pending' as const, label: 'Listo para el proximo ciclo del scheduler' };
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
      await updateExecutivePush({
        ...executivePush,
        enabled,
        updatedBy: user?.id,
      });
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
    if (
      windowStart === executivePush.windowStart &&
      windowEnd === executivePush.windowEnd &&
      nextIntervalHours === executivePush.intervalHours
    ) {
      return;
    }

    setIsSavingExecutiveSchedule(true);
    try {
      await updateExecutivePush({
        ...executivePush,
        sendTime: windowStart,
        windowStart,
        windowEnd,
        intervalHours: nextIntervalHours,
        updatedBy: user?.id,
      });
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
      safeAsyncSideEffect(fetchConfig(true), {
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
    const selectedBlocks = checked
      ? Array.from(new Set([...executivePush.selectedBlocks, blockKey as never]))
      : executivePush.selectedBlocks.filter((block) => block !== blockKey);

    const blockOrder = executivePush.blockOrder.filter((block) => selectedBlocks.includes(block));
    if (checked && !blockOrder.includes(blockKey as never)) {
      blockOrder.push(blockKey as never);
    }

    try {
      await updateExecutivePush({
        ...executivePush,
        selectedBlocks: selectedBlocks as typeof executivePush.selectedBlocks,
        blockOrder,
        updatedBy: user?.id,
      });
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
