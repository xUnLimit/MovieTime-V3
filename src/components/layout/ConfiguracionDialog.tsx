'use client';

import { BellRing, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';

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
import { useConfiguracionDialogController } from './useConfiguracionDialogController';

interface ConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function ConfiguracionDialog({ open, onOpenChange }: ConfiguracionDialogProps) {
  const {
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
  } = useConfiguracionDialogController({ open });

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
