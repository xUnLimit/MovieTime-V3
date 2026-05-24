import { Badge } from "@/components/ui/badge";
import type { ReposoRow } from "./reposo-notificaciones-table-types";

export function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    return {
      bgColor: "bg-green-100 dark:bg-green-500/20",
      hoverBgColor: "hover:bg-green-200 dark:hover:bg-green-500/30",
      textColor: "text-green-600 dark:text-green-400",
    };
  }
  if (diasRestantes <= 7) {
    return {
      bgColor: "bg-yellow-100 dark:bg-yellow-500/20",
      hoverBgColor: "hover:bg-yellow-200 dark:hover:bg-yellow-500/30",
      textColor: "text-yellow-600 dark:text-yellow-400",
    };
  }
  return {
    bgColor: "bg-blue-100 dark:bg-blue-500/20",
    hoverBgColor: "hover:bg-blue-200 dark:hover:bg-blue-500/30",
    textColor: "text-blue-600 dark:text-blue-400",
  };
}

export function getEstadoBadge(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return (
      <Badge
        variant="outline"
        className="border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
      >
        Completado
      </Badge>
    );
  }
  if (diasRestantes <= 7) {
    return (
      <Badge
        variant="outline"
        className="border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
      >
        {diasRestantes} día{diasRestantes !== 1 ? "s" : ""} restante{diasRestantes !== 1 ? "s" : ""}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
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
