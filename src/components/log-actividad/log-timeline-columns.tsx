import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Tone } from "@/components/shared/tone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getActivityDisplayConfig,
  isCorteActivityLog,
} from "@/components/shared/activity-display";
import type { ActivityLog } from "@/types";

interface LogTimelineColumnsParams {
  isAllSelected: boolean;
  selectedLogs: Set<string>;
  toggleSelectAll: () => void;
  toggleSelection: (logId: string) => void;
  onOpenCambios: (log: ActivityLog) => void;
}

const ACTION_TONES: Record<string, Tone> = {
  creacion: "success",
  actualizacion: "info",
  corte: "warning",
  eliminacion: "danger",
  renovacion: "brand",
  reembolso: "success",
};

function getActionTone(item: ActivityLog): Tone {
  if (isCorteActivityLog(item)) return "warning";
  return ACTION_TONES[item.accion] ?? "neutral";
}

function getActionLabel(item: ActivityLog) {
  if (isCorteActivityLog(item)) return "Corte";

  const labels = {
    creacion: "Creación",
    actualizacion: "Actualización",
    corte: "Corte",
    eliminacion: "Eliminación",
    renovacion: "Renovación",
    reembolso: "Reembolso",
  };
  return labels[item.accion];
}

function getEntityLabel(entidad: ActivityLog["entidad"]) {
  const labels = {
    cliente: "Cliente",
    revendedor: "Revendedor",
    servicio: "Servicio",
    tercero: "Tercero",
    categoria: "Categoría",
    metodo_pago: "Método de Pago",
    gasto: "Gasto",
    venta: "Venta",
    template: "Template",
    bot: "Bot de WhatsApp",
  };
  return labels[entidad];
}

export function createLogTimelineColumns({
  isAllSelected,
  selectedLogs,
  toggleSelectAll,
  toggleSelection,
  onOpenCambios,
}: LogTimelineColumnsParams): Column<ActivityLog>[] {
  return [
    {
      key: "checkbox",
      hideBelow: "sm",
      header: "",
      headerRender: () => (
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={toggleSelectAll}
          className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary/30"
        />
      ),
      render: (item) => (
        <Checkbox
          checked={selectedLogs.has(item.id)}
          onCheckedChange={() => toggleSelection(item.id)}
          className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary/30"
        />
      ),
    },
    {
      key: "timestamp",
      header: "Fecha",
      sortable: true,
      render: (item) => {
        const formattedTimestamp = format(
          new Date(item.timestamp),
          "dd MMM yyyy, hh:mm:ss a",
          { locale: es },
        );

        return (
          <div className="truncate text-sm" title={formattedTimestamp}>
            {formattedTimestamp}
          </div>
        );
      },
    },
    {
      key: "usuarioEmail",
      hideBelow: "lg",
      header: "Tercero",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="truncate text-sm" title={item.usuarioEmail}>
          {item.usuarioEmail}
        </div>
      ),
    },
    {
      key: "accion",
      header: "Acción",
      sortable: true,
      align: "center",
      render: (item) => (
        <StatusBadge tone={getActionTone(item)}>{getActionLabel(item)}</StatusBadge>
      ),
    },
    {
      key: "entidad",
      hideBelow: "xl",
      header: "Entidad",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="text-sm">{getEntityLabel(item.entidad)}</div>
      ),
    },
    {
      key: "detalles",
      hideBelow: "md",
      header: "Detalles",
      align: "left",
      render: (item) => {
        const { icon: Icon, color, message } = getActivityDisplayConfig(item);
        const [bgColor, textColor] = color.split(" ");
        return (
          <div className="flex w-full min-w-0 items-center gap-2 px-2">
            <div
              className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full ${bgColor}`}
            >
              <Icon className={`h-3 w-3 ${textColor}`} />
            </div>
            <span
              className="min-w-0 flex-1 truncate text-sm"
              title={item.detalles}
            >
              {message}
            </span>
          </div>
        );
      },
    },
    {
      key: "cambios",
      header: "Cambios",
      align: "center",
      render: (item) => {
        const cambiosCount = item.cambios?.length ?? 0;
        const hasMetadata =
          item.metadata && Object.keys(item.metadata).length > 0;
        return (
          <div className="flex items-center justify-center">
            {cambiosCount > 0 || hasMetadata ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onOpenCambios(item)}
                className="text-xs font-medium text-primary transition-colors hover:bg-primary/15 hover:text-primary"
              >
                <Eye className="h-3 w-3" />
                {cambiosCount > 0 ? `Ver (${cambiosCount})` : "Metadata"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground/40">-</span>
            )}
          </div>
        );
      },
    },
  ];
}
