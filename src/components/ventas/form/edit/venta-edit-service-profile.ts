import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";
import { rankServicios } from "@/lib/utils/servicioRanking";
import type { Servicio, VentaDoc } from "@/types";

export function getServicioRankingCandidateIds({
  servicios,
  tipoPlanRanking,
  ventaServicioId,
}: {
  servicios: Servicio[];
  tipoPlanRanking: string | null;
  ventaServicioId: string;
}): string[] {
  const ids = new Set<string>();
  servicios.forEach((servicio) => {
    if (servicio.id === ventaServicioId) {
      ids.add(servicio.id);
      return;
    }
    if (!servicio.activo || servicio.enReposo) return;
    if (tipoPlanRanking && servicio.tipo !== tipoPlanRanking) return;
    ids.add(servicio.id);
  });
  return Array.from(ids);
}

export function getServiciosOrdenadosForEdit({
  fechaFin,
  fechaInicio,
  perfilesOcupadosVenta,
  planCicloPago,
  servicios,
  tipoPlanRanking,
  venta,
  ventasActivasPorServicio,
}: {
  fechaFin: Date;
  fechaInicio: Date;
  perfilesOcupadosVenta: Record<string, Set<number>>;
  planCicloPago: NonNullable<VentaDoc["cicloPago"]>;
  servicios: Servicio[];
  tipoPlanRanking: string | null;
  venta: Pick<VentaDoc, "servicioId">;
  ventasActivasPorServicio: Record<string, VentaDoc[]>;
}): Servicio[] {
  const servicioOriginal = servicios.find(
    (servicio) => servicio.id === venta.servicioId,
  );
  const serviciosParaCambio = servicios
    .filter((servicio) => {
      if (servicio.id === venta.servicioId) return false;
      if (!servicio.activo || servicio.enReposo) return false;
      if (tipoPlanRanking && servicio.tipo !== tipoPlanRanking) return false;
      const ocupados =
        perfilesOcupadosVenta[servicio.id]?.size ??
        servicio.perfilesOcupados ??
        0;
      const disponibles = (servicio.perfilesDisponibles || 0) - ocupados;
      return disponibles > 0;
    })
    .sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

  const rankeados = rankServicios(
    serviciosParaCambio,
    ventasActivasPorServicio,
    {
      planCicloPago,
      fechaInicio,
      fechaFin,
    },
  );

  return servicioOriginal ? [...rankeados, servicioOriginal] : rankeados;
}

export function getSlotsDisponiblesForEdit({
  perfilesOcupadosVenta,
  servicioId,
  servicios,
}: {
  perfilesOcupadosVenta: Record<string, Set<number>>;
  servicioId: string;
  servicios: Servicio[];
}): number {
  const servicio = servicios.find((item) => item.id === servicioId);
  if (!servicio) return 0;
  const ocupadosReales = perfilesOcupadosVenta[servicioId];
  if (ocupadosReales !== undefined) {
    return Math.max(
      (servicio.perfilesDisponibles || 0) - ocupadosReales.size,
      0,
    );
  }
  const ocupadosActual = servicio.perfilesOcupados || 0;
  return Math.max((servicio.perfilesDisponibles || 0) - ocupadosActual, 0);
}

export function getPerfilesDropdownForEdit({
  perfilesOcupadosVenta,
  servicioId,
  servicioSeleccionado,
}: {
  perfilesOcupadosVenta: Record<string, Set<number>>;
  servicioId: string;
  servicioSeleccionado?: Servicio;
}): number[] {
  if (!servicioId) return [];

  const totalPerfiles = servicioSeleccionado?.perfilesDisponibles || 0;
  if (totalPerfiles <= 0) return [];

  const ocupadosEnVentas =
    perfilesOcupadosVenta[servicioId] ?? new Set<number>();
  const isDisponible = (numero: number) => !ocupadosEnVentas.has(numero);

  if (totalPerfiles <= PROFILE_PAGE_SIZE) {
    return Array.from({ length: totalPerfiles }, (_, index) => index + 1).filter(
      isDisponible,
    );
  }

  const bloqueTamano = 5;
  const totalBloques = Math.ceil(totalPerfiles / bloqueTamano);

  for (let bloque = 0; bloque < totalBloques; bloque++) {
    const inicio = bloque * bloqueTamano + 1;
    const fin = Math.min(inicio + bloqueTamano - 1, totalPerfiles);
    const disponiblesBloque = Array.from(
      { length: fin - inicio + 1 },
      (_, index) => inicio + index,
    ).filter(isDisponible);

    if (disponiblesBloque.length > 0) return disponiblesBloque;
  }

  return [];
}

export function getDisponiblesColorClass(disponibles: number, total: number) {
  if (total <= 0) return "text-muted-foreground";
  const ratio = disponibles / total;
  if (ratio <= 0.25) return "text-[#ff1744]";
  if (ratio <= 0.5) return "text-[#ffea00]";
  return "text-[#00ff85]";
}
