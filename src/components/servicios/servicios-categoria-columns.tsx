import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, User } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { getEstadoBadge } from "@/components/shared/vencimiento-status";
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

const serviciosCategoriaColumns: Column<ServicioCategoriaRow>[] = [
  {
    key: "nombre",
    header: "Nombre",
    sortable: true,
    render: (item) => <div className="font-medium">{item.nombre}</div>,
  },
  {
    key: "correo",
    hideBelow: "lg",
    header: "Email",
    sortable: true,
    render: (item) => <div className="text-sm">{item.correo}</div>,
  },
  {
    key: "fechaInicio",
    hideBelow: "2xl",
    header: "Fecha de Inicio",
    sortable: true,
    align: "left",
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
    hideBelow: "xl",
    header: "Fecha de Vencimiento",
    sortable: true,
    align: "center",
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
    hideBelow: "sm",
    header: "Dias Restantes",
    sortable: true,
    align: "center",
    render: (item) => {
      if (!item.activo) {
        return <span className="text-muted-foreground">-</span>;
      }

      const dias = calcularDiasRestantes(item.fechaVencimiento);
      const { variant: className, text } = getEstadoBadge(dias, false);
      return (
        <Badge variant="outline" className={className}>
          {text}
        </Badge>
      );
    },
  },
  {
    key: "renovaciones",
    hideBelow: "2xl",
    header: "Renovaciones",
    sortable: true,
    align: "center",
    render: (item) => (
      <div className="flex items-center justify-center gap-1.5">
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{item.renovaciones || 0}</span>
      </div>
    ),
  },
  {
    key: "perfiles",
    hideBelow: "md",
    header: "Perfiles",
    sortable: false,
    align: "center",
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
                  ? "text-muted-foreground"
                  : state === "occupied"
                    ? "text-danger"
                    : "text-success";

              return (
                <User
                  key={`${item.id}-indicator-${index}`}
                  className={`h-4 w-4 ${iconColor}`}
                />
              );
            })}
            {perfilesRestantes > 0 && (
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                +{perfilesRestantes}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            <span
              className={`font-medium ${libres > 0 ? "text-success" : "text-danger"}`}
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
    render: (item) => (
      <Badge
        variant="outline"
        className={
          item.activo
            ? "border-success-border bg-success-subtle text-success"
            : "border-danger-border bg-danger-subtle text-danger"
        }
      >
        {item.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

export const serviciosCategoriaColumnsForDataTable = serviciosCategoriaColumns;
