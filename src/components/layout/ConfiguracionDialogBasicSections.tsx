import { RefreshCw, Smartphone, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatSyncDate } from "@/lib/pwa/format-sync-date";
import type { useConfiguracionDialogController } from "./useConfiguracionDialogController";

type ConfiguracionController = ReturnType<typeof useConfiguracionDialogController>;

export function DashboardViewSection({
  availableYears,
  selectedYear,
  setSelectedYear,
}: Pick<ConfiguracionController, "availableYears" | "selectedYear" | "setSelectedYear">) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Vista del dashboard</h3>
        <p className="text-xs text-muted-foreground">
          Los widgets mostraran ingresos y gastos acumulados del ano seleccionado.
        </p>
      </div>
      <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(parseInt(value, 10))}>
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
  );
}

export function OfflineSection({
  handleOfflineRefresh,
  isInstalled,
  isOfflineReady,
  isOnline,
  lastSyncAt,
  syncProgress,
  syncStatus,
}: Pick<
  ConfiguracionController,
  "handleOfflineRefresh" | "isInstalled" | "isOfflineReady" | "isOnline" | "lastSyncAt" | "syncProgress" | "syncStatus"
>) {
  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Modo offline</h3>
          <p className="text-xs text-muted-foreground">
            La app guarda una copia de lectura para usarla sin internet.
          </p>
        </div>
        {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-red-500" />}
      </div>

      <div className="grid gap-2 text-sm">
        <StatusRow label="Estado de red" value={isOnline ? "En linea" : "Sin conexion"} />
        <StatusRow label="Copia offline" value={isOfflineReady ? "Lista" : "Pendiente"} />
        <StatusRow label="Ultima sincronizacion" value={formatSyncDate(lastSyncAt)} alignRight />
        <StatusRow label="Instalada como app" value={isInstalled ? "Si" : "No"} />
      </div>

      {syncStatus === "syncing" && syncProgress ? (
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
        disabled={!isOnline || syncStatus === "syncing"}
        className="w-full sm:w-auto"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
        {syncStatus === "syncing" ? "Sincronizando..." : "Actualizar copia offline"}
      </Button>
    </section>
  );
}

export function DevicePushSection({
  handlePushSubscriptionToggle,
  isPushSupported,
  notificationPermission,
  pushSubscribed,
}: Pick<
  ConfiguracionController,
  "handlePushSubscriptionToggle" | "isPushSupported" | "notificationPermission" | "pushSubscribed"
>) {
  return (
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
        <StatusRow label="Soporte del navegador" value={isPushSupported ? "Compatible" : "No compatible"} />
        <StatusRow label="Permiso" value={notificationPermission} />
        <StatusRow label="Suscripcion activa" value={pushSubscribed ? "Si" : "No"} />
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
  );
}

function StatusRow({ label, value, alignRight = false }: { label: string; value: string; alignRight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`text-muted-foreground ${alignRight ? "text-right" : ""}`}>{value}</span>
    </div>
  );
}
