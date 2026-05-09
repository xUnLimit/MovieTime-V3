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
import {
  getPushSubscriptionStatus,
  registerPushSubscription,
  unregisterPushSubscription,
} from '@/lib/pwa/push-client';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { usePwaStore } from '@/store/pwaStore';

interface ConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function ConfiguracionDialog({ open, onOpenChange }: ConfiguracionDialogProps) {
  const user = useAuthStore((state) => state.user);
  const { stats } = useDashboardStore();
  const { selectedYear, setSelectedYear } = useDashboardFilterStore();
  const { config, fetchConfig, updateExecutivePush } = useConfigStore();
  const {
    isInstalled,
    isOnline,
    isPushSupported,
    isOfflineReady,
    lastSyncAt,
    syncStatus,
    notificationPermission,
    hydrateOfflineState,
    setNotificationPermission,
    syncOfflineData,
  } = usePwaStore();

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSavingExecutiveTime, setIsSavingExecutiveTime] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchConfig(true).catch((error) => {
      console.error('Error fetching config:', error);
    });
    hydrateOfflineState().catch(() => undefined);
    getPushSubscriptionStatus()
      .then((status) => {
        setPushSubscribed(status.subscribed);
        setNotificationPermission(status.permission);
      })
      .catch(() => undefined);
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

  const handleTimeChange = async (sendTime: string) => {
    if (!executivePush) return;
    if (!sendTime) {
      toast.error('Selecciona una hora de envio valida.');
      return;
    }

    setIsSavingExecutiveTime(true);
    try {
      await updateExecutivePush({
        ...executivePush,
        sendTime,
        updatedBy: user?.id,
      });
      toast.success(`Hora de push aplicada: ${sendTime}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la hora de envio.');
    } finally {
      setIsSavingExecutiveTime(false);
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
      <DialogContent className="top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] grid max-h-[100dvh] overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b bg-background px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:pt-6">
          <DialogTitle>Configuracion</DialogTitle>
          <DialogDescription>
            Ajustes del dashboard, modo offline y push ejecutivas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 sm:pb-6">
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
                <h3 className="text-sm font-semibold">Push ejecutiva diaria</h3>
                <p className="text-xs text-muted-foreground">
                  Resumen operativo para admins con deep link al modulo relacionado.
                </p>
              </div>
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
              <div>
                <Label htmlFor="executive-push-enabled" className="text-sm font-medium">
                  Activar push ejecutiva diaria
                </Label>
                <p className="text-xs text-muted-foreground">
                  Usa una plantilla configurable y se envia segun la hora definida.
                </p>
              </div>
              <Switch
                id="executive-push-enabled"
                checked={executivePush?.enabled ?? false}
                onCheckedChange={handleExecutivePushToggle}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="executive-send-time">Hora de envio</Label>
                <Input
                  id="executive-send-time"
                  type="time"
                  value={executivePush?.sendTime ?? '08:00'}
                  disabled={isSavingExecutiveTime}
                  onChange={(event) => void handleTimeChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {isSavingExecutiveTime ? 'Guardando hora...' : 'Se aplica al siguiente ciclo del scheduler.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="executive-timezone">Timezone</Label>
                <Input
                  id="executive-timezone"
                  value={executivePush?.timezone ?? 'America/Bogota'}
                  readOnly
                />
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

            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              La push diaria usa un ping web push y el service worker resuelve el resumen vigente antes de mostrarlo.
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
