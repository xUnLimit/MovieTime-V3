import { Badge } from "@/components/ui/badge";
import type { ReposoRow } from "./reposo-notificaciones-table-types";

export function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    return {
      bgColor: "bg-success-subtle",
      hoverBgColor: "hover:bg-success/15",
      textColor: "text-success",
    };
  }
  if (diasRestantes <= 7) {
    return {
      bgColor: "bg-warning-subtle",
      hoverBgColor: "hover:bg-warning/15",
      textColor: "text-warning",
    };
  }
  return {
    bgColor: "bg-info-subtle",
    hoverBgColor: "hover:bg-info/15",
    textColor: "text-info",
  };
}

export function getEstadoBadge(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return (
      <Badge
        variant="outline"
        className="border-success-border bg-success-subtle text-success"
      >
        Completado
      </Badge>
    );
  }
  if (diasRestantes <= 7) {
    return (
      <Badge
        variant="outline"
        className="border-warning-border bg-warning-subtle text-warning"
      >
        {diasRestantes} día{diasRestantes !== 1 ? "s" : ""} restante{diasRestantes !== 1 ? "s" : ""}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-info-border bg-info-subtle text-info"
    >
      {diasRestantes} días restantes
    </Badge>
  );
}

export function formatearFechaReposo(fechaStr: string): string {
  const fecha = new Date(fechaStr);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${fecha.getDate()} de ${meses[fecha.getMonth()]} del ${fecha.getFullYear()}`;
}

export function filterReposoRows({
  estadoFilter,
  reposoNotificaciones,
  search,
}: {
  estadoFilter: string;
  reposoNotificaciones: ReposoRow[];
  search: string;
}) {
  let result = reposoNotificaciones;

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (notificacion) =>
        notificacion.categoriaNombre?.toLowerCase().includes(q) ||
        notificacion.correo?.toLowerCase().includes(q),
    );
  }

  if (estadoFilter === "completado") {
    return result.filter((notificacion) => notificacion.diasRestantes <= 0);
  }
  if (estadoFilter === "proximo_finalizar") {
    return result.filter(
      (notificacion) => notificacion.diasRestantes > 0 && notificacion.diasRestantes <= 7,
    );
  }
  if (estadoFilter === "en_proceso") {
    return result.filter((notificacion) => notificacion.diasRestantes > 7);
  }

  return result;
}

export function normalizeReposoDate(fecha: Date | string | undefined | null) {
  if (!fecha) return null;
  return fecha instanceof Date ? fecha.toISOString() : String(fecha);
}
