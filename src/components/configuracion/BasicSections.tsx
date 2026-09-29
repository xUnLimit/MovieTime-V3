import { BellRing, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { useConfiguracionController } from "./useConfiguracionController";

type ConfiguracionController = ReturnType<typeof useConfiguracionController>;

export function DashboardViewSection({
  availableYears,
  selectedYear,
  setSelectedYear,
}: Pick<ConfiguracionController, "availableYears" | "selectedYear" | "setSelectedYear">) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
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

export function DevicePushSection({
  handlePushSubscriptionToggle,
  handleTestPush,
  isPushSupported,
  isSendingTestPush,
  notificationPermission,
  pushSubscribed,
}: Pick<
  ConfiguracionController,
  "handlePushSubscriptionToggle" | "handleTestPush" | "isPushSupported" | "isSendingTestPush" | "notificationPermission" | "pushSubscribed"
>) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
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
      <Button
        type="button"
        variant="outline"
        onClick={handleTestPush}
        disabled={!pushSubscribed || !isPushSupported || isSendingTestPush}
        className="w-full sm:w-auto"
      >
        <BellRing className={`mr-2 h-4 w-4 ${isSendingTestPush ? "animate-pulse" : ""}`} />
        {isSendingTestPush ? "Enviando..." : "Enviar prueba a este dispositivo"}
      </Button>
      <p className="text-xs text-muted-foreground">
        La prueba funciona aunque los recordatorios ejecutivos estén desactivados.
      </p>
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
