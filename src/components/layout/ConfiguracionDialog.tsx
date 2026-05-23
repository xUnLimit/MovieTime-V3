'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { formatSyncDate } from '@/lib/pwa/format-sync-date';
import { EXECUTIVE_PUSH_BLOCKS } from '@/lib/pwa/push-constants';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import {
  getPushSubscriptionStatus,
  registerPushSubscription,
  triggerExecutivePushTest,
  unregisterPushSubscription,
} from '@/lib/pwa/push-client';
import { getExecutivePushDueStatus } from '@/lib/pwa/push-schedule';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { usePwaStore } from '@/store/pwaStore';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';

interface ConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function ConfiguracionDialog({ open, onOpenChange }: ConfiguracionDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 flex h-[100dvh] max-h-[100dvh] translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-x-0 p-0 sm:top-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-y-[-50%] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b bg-background px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:pt-6">
          <DialogTitle>Configuracion</DialogTitle>
          <DialogDescription>
            Ajustes del dashboard, modo offline y push ejecutivas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 sm:pb-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Vista del dashboard</h3>
              <p className="text-xs text-muted-foreground">
                Los widgets mostraran ingresos y gastos acumulados del ano seleccionado.
              </p>
            </div>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year === new Date().getFullYear() ? `${year} (actual)` : String(year)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Modo offline</h3>
                <p className="text-xs text-muted-foreground">
                  La app guarda una copia de lectura para usarla sin internet.
                </p>
              </div>
              {isOnline ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Estado de red</span>
                <span className="text-muted-foreground">{isOnline ? 'En linea' : 'Sin conexion'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Copia offline</span>
                <span className="text-muted-foreground">{isOfflineReady ? 'Lista' : 'Pendiente'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Ultima sincronizacion</span>
                <span className="text-muted-foreground text-right">{formatSyncDate(lastSyncAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Instalada como app</span>
                <span className="text-muted-foreground">{isInstalled ? 'Si' : 'No'}</span>
              </div>
            </div>

            {syncStatus === 'syncing' && syncProgress ? (
              <div className="space-y-2 rounded-md bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">{syncProgress.label}</span>
                  <span className="shrink-0 font-medium">{syncProgress.percentage}%</span>
                </div>
                <Progress value={syncProgress.percentage} aria-label="Progreso de sincronizacion offline" />
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={handleOfflineRefresh}
              disabled={!isOnline || syncStatus === 'syncing'}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'syncing' ? 'Sincronizando...' : 'Actualizar copia offline'}
            </Button>
          </section>

          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Push web en este dispositivo</h3>
                <p className="text-xs text-muted-foreground">
                  En iPhone requiere Safari, app agregada a pantalla de inicio y permiso concedido.
                </p>
              </div>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Soporte del navegador</span>
                <span className="text-muted-foreground">{isPushSupported ? 'Compatible' : 'No compatible'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Permiso</span>
                <span className="text-muted-foreground">{notificationPermission}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Suscripcion activa</span>
                <span className="text-muted-foreground">{pushSubscribed ? 'Si' : 'No'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
              <div>
                <Label htmlFor="device-push" className="text-sm font-medium">
                  Recibir push en este dispositivo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Activa o desactiva la suscripcion del navegador actual.
                </p>
              </div>
              <Switch
                id="device-push"
                checked={pushSubscribed}
                disabled={!isPushSupported}
                onCheckedChange={handlePushSubscriptionToggle}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Recordatorios ejecutivos</h3>
                <p className="text-xs text-muted-foreground">
                  Resumen operativo para admins con deep link al modulo relacionado.
                </p>
              </div>
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
              <div>
                <Label htmlFor="executive-push-enabled" className="text-sm font-medium">
                  Activar recordatorios ejecutivos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Solo se envia dentro de la ventana definida y cuando hay pendientes activos.
                </p>
              </div>
              <Switch
                id="executive-push-enabled"
                checked={executivePushConfigReady ? executivePush?.enabled === true : false}
                disabled={!executivePushConfigReady}
                onCheckedChange={handleExecutivePushToggle}
              />
            </div>

            {executivePushStatus ? (
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span
                  className={
                    executivePushStatus.tone === 'warning'
                      ? 'font-medium text-amber-600'
                      : executivePushStatus.tone === 'pending'
                      ? 'font-medium text-amber-600'
                      : 'font-medium text-muted-foreground'
                  }
                >
                  {executivePushStatus.label}
                </span>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="executive-window-start">Inicio de ventana</Label>
                <Input
                  id="executive-window-start"
                  type="time"
                  value={draftWindowStart || executivePush?.windowStart || '08:00'}
                  disabled={isSavingExecutiveSchedule}
                  onChange={(event) => setDraftWindowStart(event.target.value)}
                  onBlur={() => void handleScheduleCommit()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {isSavingExecutiveSchedule ? 'Guardando...' : 'Primer intento del ciclo.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="executive-window-end">Fin de ventana</Label>
                <Input
                  id="executive-window-end"
                  type="time"
                  value={draftWindowEnd || executivePush?.windowEnd || '22:00'}
                  disabled={isSavingExecutiveSchedule}
                  onChange={(event) => setDraftWindowEnd(event.target.value)}
                  onBlur={() => void handleScheduleCommit()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">No se envia fuera de esta ventana.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="executive-interval">Intervalo</Label>
                <Select
                  value={String(draftIntervalHours ?? executivePush?.intervalHours ?? 24)}
                  disabled={isSavingExecutiveSchedule || !executivePush}
                  onValueChange={(value) => {
                    const nextInterval = Number(value);
                    setDraftIntervalHours(nextInterval);
                    void handleScheduleCommit(nextInterval);
                  }}
                >
                  <SelectTrigger id="executive-interval" className="w-full">
                    <SelectValue placeholder="Seleccionar intervalo" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {[1, 2, 4, 6, 8, 12, 24].map((hours) => (
                      <SelectItem key={hours} value={String(hours)}>
                        Cada {hours} h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se cuenta desde el ultimo envio exitoso.</p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <div className="flex h-10 w-full select-none items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  {executivePush?.timezone ?? 'America/Bogota'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bloques del resumen</Label>
              <div className="grid gap-2">
                {EXECUTIVE_PUSH_BLOCKS.map((block) => (
                  <label key={block.key} className="flex items-start gap-3 rounded-md border px-3 py-2">
                    <Checkbox
                      checked={Boolean(executivePush?.selectedBlocks.includes(block.key))}
                      onCheckedChange={(checked) => void handleBlockToggle(block.key, checked === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{block.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Abre {block.destination}{block.tab ? ` en el tab ${block.tab}` : ''}.
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestPush}
              disabled={!executivePush?.enabled || isSendingTestPush}
              className="w-full sm:w-auto"
            >
              <BellRing className={`mr-2 h-4 w-4 ${isSendingTestPush ? 'animate-pulse' : ''}`} />
              {isSendingTestPush ? 'Enviando...' : 'Enviar prueba ahora'}
            </Button>

            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              El cron revisa cada minuto, pero solo envia si hay bloques activos y ya paso el intervalo configurado.
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
