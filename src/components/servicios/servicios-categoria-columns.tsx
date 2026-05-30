import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, User } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { CURRENCY_SYMBOLS } from "@/platform/constants";
import { calcularDiasRelativosCalendario } from "@/platform/utils/calculations";
import {
  getProfileIndicatorStates,
  PROFILE_ICON_LIMIT,
} from "@/platform/utils/perfiles";
import type { Servicio } from "@/types";

export type ServicioCategoriaRow = Servicio & {
  fechaVencimientoSort: number;
};

export function toServicioCategoriaRow(
  servicio: Servicio,
): ServicioCategoriaRow {
  return {
    ...servicio,
    fechaVencimientoSort: servicio.fechaVencimiento
      ? new Date(servicio.fechaVencimiento).getTime()
      : Number.POSITIVE_INFINITY,
  };
}

function getCurrencySymbol(moneda?: string) {
  if (!moneda) return "$";
  return CURRENCY_SYMBOLS[moneda] || "$";
}

function calcularDiasRestantes(fechaVencimiento?: Date) {
  return calcularDiasRelativosCalendario(fechaVencimiento) ?? 0;
}

function getEstadoBadge(dias: number): { className: string; text: string } {
  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      className:
        "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      text: `${d} dia${d > 1 ? "s" : ""} de retraso`,
    };
  }
  if (dias === 0) {
    return {
      className:
        "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      text: "Vence hoy",
    };
  }
  if (dias <= 7) {
    return {
      className:
        "border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
      text: `${dias} dia${dias > 1 ? "s" : ""} restante${dias > 1 ? "s" : ""}`,
    };
  }
  return {
    className:
      "border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    text: `${dias} dia${dias > 1 ? "s" : ""} restante${dias > 1 ? "s" : ""}`,
  };
}

const serviciosCategoriaColumns: Column<ServicioCategoriaRow>[] = [
  {
    key: "nombre",
    header: "Nombre",
    sortable: true,
    width: "10%",
    render: (item) => <div className="font-medium">{item.nombre}</div>,
  },
  {
    key: "correo",
    header: "Email",
    sortable: true,
    width: "14%",
    render: (item) => <div className="text-sm">{item.correo}</div>,
  },
  {
    key: "fechaInicio",
    header: "Fecha de Inicio",
    sortable: true,
    align: "left",
    width: "12%",
    render: (item) => (
      <div className="text-sm">
        {item.fechaInicio
          ? format(new Date(item.fechaInicio), "dd 'de' MMMM 'del' yyyy", {
              locale: es,
            })
          : "-"}
      </div>
    ),
  },
  {
    key: "fechaVencimientoSort",
    header: "Fecha de Vencimiento",
    sortable: true,
    align: "center",
    width: "12%",
    render: (item) => (
      <div className="text-sm">
        {item.fechaVencimiento
          ? format(new Date(item.fechaVencimiento), "dd 'de' MMMM 'del' yyyy", {
              locale: es,
            })
          : "-"}
      </div>
    ),
  },
  {
    key: "costoServicio",
    header: "Costo",
    sortable: true,
    align: "center",
    width: "7%",
    render: (item) => (
      <div className="flex items-center justify-center gap-1">
        <span className="font-medium">{getCurrencySymbol(item.moneda)}</span>
        <span className="font-medium">
          {(item.costoServicio || 0).toFixed(2)}
        </span>
      </div>
    ),
  },
  {
    key: "fechaVencimiento",
    header: "Dias Restantes",
    sortable: true,
    align: "center",
    width: "11%",
    render: (item) => {
      if (!item.activo) {
        return <span className="text-muted-foreground">-</span>;
      }

      const dias = calcularDiasRestantes(item.fechaVencimiento);
      const { className, text } = getEstadoBadge(dias);
      return (
        <Badge variant="outline" className={className}>
          {text}
        </Badge>
      );
    },
  },
  {
    key: "renovaciones",
    header: "Renovaciones",
    sortable: true,
    align: "center",
    width: "8%",
    render: (item) => (
      <div className="flex items-center justify-center gap-1.5">
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{item.renovaciones || 0}</span>
      </div>
    ),
  },
  {
    key: "perfiles",
    header: "Perfiles",
    sortable: false,
    align: "center",
    width: "12%",
    render: (item) => {
      const ocupados = item.perfilesOcupados || 0;
      const disponibles = item.perfilesDisponibles || 0;
      const libres = !item.activo ? 0 : Math.max(disponibles - ocupados, 0);
      const indicatorStates = getProfileIndicatorStates(
        disponibles,
        ocupados,
        item.activo,
        PROFILE_ICON_LIMIT,
      );
      const perfilesRestantes = Math.max(
        disponibles - indicatorStates.length,
        0,
      );

      return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-0.5">
            {indicatorStates.map((state, index) => {
              const iconColor =
                state === "inactive"
                  ? "text-gray-600"
                  : state === "occupied"
                    ? "text-red-500"
                    : "text-green-500";

              return (
                <User
                  key={`${item.id}-indicator-${index}`}
                  className={`h-4 w-4 ${iconColor}`}
                />
              );
            })}
            {perfilesRestantes > 0 && (
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                +{perfilesRestantes}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            <span
              className={`font-medium ${libres > 0 ? "text-green-600" : "text-red-600"}`}
            >
              {libres}
            </span>
            <span>/{disponibles} disponibles</span>
          </span>
        </div>
      );
    },
  },
  {
    key: "estado",
    header: "Estado",
    sortable: false,
    align: "center",
    width: "7%",
    render: (item) => (
      <Badge
        variant="outline"
        className={
          item.activo
            ? "border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
            : "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
        }
      >
        {item.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

export const serviciosCategoriaColumnsForDataTable = serviciosCategoriaColumns;
