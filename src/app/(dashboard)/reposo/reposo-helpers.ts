import { differenceInDays, startOfDay } from "date-fns";

import { queryMetodosPago } from "@/lib/supabase/catalogos-repository";
import { fetchServiciosByFiltersUseCase } from "@/lib/use-cases/servicios/servicios-query-use-cases";
import type { MetodoPago } from "@/types/metodos-pago";
import type { Servicio } from "@/types/servicios";

export interface ReposoServicio extends Servicio {
  diasRestantes: number;
  progreso: number;
  estadoReposo: "en_proceso" | "proximo_finalizar" | "completado";
}

export function calcularReposoData(servicio: Servicio): ReposoServicio {
  const hoy = startOfDay(new Date());
  const fechaFin = servicio.fechaFinReposo
    ? startOfDay(new Date(servicio.fechaFinReposo))
    : hoy;
  const fechaInicio = servicio.fechaInicioReposo
    ? startOfDay(new Date(servicio.fechaInicioReposo))
    : hoy;
  const diasRestantes = differenceInDays(fechaFin, hoy);
  const diasTotales =
    servicio.diasReposo || differenceInDays(fechaFin, fechaInicio) || 1;
  const diasTranscurridos = diasTotales - diasRestantes;
  const progreso = Math.min(
    100,
    Math.max(0, (diasTranscurridos / diasTotales) * 100),
  );

  let estadoReposo: ReposoServicio["estadoReposo"] = "en_proceso";
  if (diasRestantes <= 0) estadoReposo = "completado";
  else if (diasRestantes <= 7) estadoReposo = "proximo_finalizar";

  return { ...servicio, diasRestantes, progreso, estadoReposo };
}

export function sortReposoServicios(servicios: ReposoServicio[]) {
  return [...servicios].sort((a, b) => {
    if (a.estadoReposo === "completado" && b.estadoReposo !== "completado") {
      return -1;
    }
    if (a.estadoReposo !== "completado" && b.estadoReposo === "completado") {
      return 1;
    }
    return a.diasRestantes - b.diasRestantes;
  });
}

export async function fetchReposoServicesQuery(): Promise<ReposoServicio[]> {
  const servicios = await fetchServiciosByFiltersUseCase<Servicio>([
    { field: "enReposo", operator: "==", value: true },
  ]);
  return sortReposoServicios(servicios.map(calcularReposoData));
}

export async function fetchServicioMetodosPagoQuery(): Promise<MetodoPago[]> {
  return queryMetodosPago<MetodoPago>([
    { field: "asociadoA", operator: "==", value: "servicio" },
  ]);
}

export function getReposoMetrics(servicios: ReposoServicio[]) {
  return {
    enProceso: servicios.filter((s) => s.estadoReposo === "en_proceso").length,
    proximosFinalizar: servicios.filter(
      (s) => s.estadoReposo === "proximo_finalizar",
    ).length,
    completados: servicios.filter((s) => s.estadoReposo === "completado").length,
  };
}

export function filterReposoServicios({
  estadoFilter,
  search,
  servicios,
}: {
  estadoFilter: string;
  search: string;
  servicios: ReposoServicio[];
}) {
  let result = servicios;
  if (estadoFilter !== "all") {
    result = result.filter((s) => s.estadoReposo === estadoFilter);
  }
  if (search.trim()) {
    const query = search.toLowerCase();
    result = result.filter(
      (servicio) =>
        servicio.nombre.toLowerCase().includes(query) ||
        servicio.correo.toLowerCase().includes(query),
    );
  }
  return result;
}
