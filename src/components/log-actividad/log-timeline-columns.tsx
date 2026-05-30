import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  activityActionColors,
  getActivityDisplayConfig,
  isCorteActivityLog,
} from "@/platform/utils/activityDisplayHelpers";
import type { ActivityLog } from "@/types";

interface LogTimelineColumnsParams {
  isAllSelected: boolean;
  selectedLogs: Set<string>;
  toggleSelectAll: () => void;
  toggleSelection: (logId: string) => void;
  onOpenCambios: (log: ActivityLog) => void;
}

function getActionBadgeStyle(item: ActivityLog) {
  if (isCorteActivityLog(item)) {
    return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30";
  }

  const styles: Record<string, string> = {
    creacion:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    actualizacion:
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    corte:
      "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    eliminacion:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    renovacion:
      "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    reembolso:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
  };
  return styles[item.accion] ?? activityActionColors[item.accion] ?? "";
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
      header: "",
      width: "40px",
      headerRender: () => (
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={toggleSelectAll}
          className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
        />
      ),
      render: (item) => (
        <Checkbox
          checked={selectedLogs.has(item.id)}
          onCheckedChange={() => toggleSelection(item.id)}
          className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
        />
      ),
    },
    {
      key: "timestamp",
      header: "Fecha",
      sortable: true,
      width: "170px",
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
      header: "Tercero",
      sortable: true,
      align: "center",
      width: "180px",
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
      width: "130px",
      render: (item) => (
        <Badge variant="outline" className={getActionBadgeStyle(item)}>
          {getActionLabel(item)}
        </Badge>
      ),
    },
    {
      key: "entidad",
      header: "Entidad",
      sortable: true,
      align: "center",
      width: "120px",
      render: (item) => (
        <div className="text-sm">{getEntityLabel(item.entidad)}</div>
      ),
    },
    {
      key: "detalles",
      header: "Detalles",
      align: "left",
      width: "340px",
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
      width: "110px",
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
                className="text-xs font-medium text-purple-600 transition-colors hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
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
