import { BellRing } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EXECUTIVE_PUSH_BLOCKS } from "@/modules/pwa/push-constants";
import type { useConfiguracionController } from "./useConfiguracionController";

type ConfiguracionController = ReturnType<typeof useConfiguracionController>;

export function ExecutivePushSection({
  draftIntervalHours,
  draftWindowEnd,
  draftWindowStart,
  executivePush,
  executivePushConfigReady,
  executivePushStatus,
  handleBlockToggle,
  handleExecutivePushToggle,
  handleScheduleCommit,
  isSavingExecutiveSchedule,
  setDraftIntervalHours,
  setDraftWindowEnd,
  setDraftWindowStart,
}: Pick<
  ConfiguracionController,
  | "draftIntervalHours"
  | "draftWindowEnd"
  | "draftWindowStart"
  | "executivePush"
  | "executivePushConfigReady"
  | "executivePushStatus"
  | "handleBlockToggle"
  | "handleExecutivePushToggle"
  | "handleScheduleCommit"
  | "isSavingExecutiveSchedule"
  | "setDraftIntervalHours"
  | "setDraftWindowEnd"
  | "setDraftWindowStart"
>) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
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
          <span className={getStatusClassName(executivePushStatus.tone)}>
            {executivePushStatus.label}
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ScheduleTimeInput
          id="executive-window-start"
          label="Inicio de ventana"
          value={draftWindowStart || executivePush?.windowStart || "08:00"}
          disabled={isSavingExecutiveSchedule}
          helper={isSavingExecutiveSchedule ? "Guardando..." : "Primer intento del ciclo."}
          onChange={setDraftWindowStart}
          onCommit={handleScheduleCommit}
        />
        <ScheduleTimeInput
          id="executive-window-end"
          label="Fin de ventana"
          value={draftWindowEnd || executivePush?.windowEnd || "22:00"}
          disabled={isSavingExecutiveSchedule}
          helper="No se envia fuera de esta ventana."
          onChange={setDraftWindowEnd}
          onCommit={handleScheduleCommit}
        />
        <IntervalSelect
          value={draftIntervalHours ?? executivePush?.intervalHours ?? 24}
          disabled={isSavingExecutiveSchedule || !executivePush}
          onChange={(nextInterval) => {
            setDraftIntervalHours(nextInterval);
            void handleScheduleCommit(nextInterval);
          }}
        />
        <div className="space-y-2">
          <Label>Timezone</Label>
          <div className="flex h-10 w-full select-none items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            {executivePush?.timezone ?? "America/Bogota"}
          </div>
        </div>
      </div>

      <ExecutiveBlocks selectedBlocks={executivePush?.selectedBlocks ?? []} onToggle={handleBlockToggle} />

      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        El cron revisa cada minuto, pero solo envia si hay bloques activos y ya paso el intervalo configurado.
      </div>
    </section>
  );
}

function ScheduleTimeInput({
  disabled,
  helper,
  id,
  label,
  onChange,
  onCommit,
  value,
}: {
  disabled: boolean;
  helper: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onCommit: () => Promise<void>;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => void onCommit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function IntervalSelect({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="executive-interval">Intervalo</Label>
      <Select value={String(value)} disabled={disabled} onValueChange={(next) => onChange(Number(next))}>
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
  );
}

function ExecutiveBlocks({
  onToggle,
  selectedBlocks,
}: {
  onToggle: ConfiguracionController["handleBlockToggle"];
  selectedBlocks: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>Bloques del resumen</Label>
      <div className="grid gap-2">
        {EXECUTIVE_PUSH_BLOCKS.map((block) => (
          <label key={block.key} className="flex items-start gap-3 rounded-md border px-3 py-2">
            <Checkbox
              checked={selectedBlocks.includes(block.key)}
              onCheckedChange={(checked) => void onToggle(block.key, checked === true)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{block.label}</span>
              <span className="block text-xs text-muted-foreground">
                Abre {block.destination}{block.tab ? ` en el tab ${block.tab}` : ""}.
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function getStatusClassName(tone: string) {
  return tone === "warning" || tone === "pending"
    ? "font-medium text-warning"
    : "font-medium text-muted-foreground";
}
