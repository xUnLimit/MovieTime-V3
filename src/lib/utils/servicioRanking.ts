import { addMonths, differenceInCalendarDays } from 'date-fns';

import { MESES_POR_CICLO } from '@/features/ventas/ventas-form-shared';
import type { Servicio, VentaDoc } from '@/types';

/**
 * Ordena servicios del mejor al peor para alojar un nuevo cliente.
 *
 * Prioridad:
 * 1. Servicio vacío (sin ventas activas) → score máximo; el más reciente va primero.
 * 2. Menor diferencia promedio de días restantes entre clientes existentes y el nuevo.
 *    Bonus si todos los clientes existentes comparten el mismo cicloPago que el plan nuevo.
 * 3. Desempate: más slots disponibles.
 */
export function rankServicios(
  servicios: Servicio[],
  ventasPorServicio: Record<string, VentaDoc[]>,
  planCicloPago: string,
  fechaInicio: Date = new Date(),
): Servicio[] {
  const meses = MESES_POR_CICLO[planCicloPago as keyof typeof MESES_POR_CICLO] ?? 1;
  const fechaFinNuevo = addMonths(fechaInicio, meses);
  const diasRestantesNuevo = differenceInCalendarDays(fechaFinNuevo, fechaInicio);
  const hoy = new Date();

  const scored = servicios.map((servicio) => {
    const ventasActivas = ventasPorServicio[servicio.id] ?? [];
    const slotsDisponibles = (servicio.perfilesDisponibles ?? 0) - (servicio.perfilesOcupados ?? 0);

    if (ventasActivas.length === 0) {
      const createdMs = servicio.createdAt ? new Date(servicio.createdAt as unknown as string).getTime() : 0;
      return { servicio, score: 1_000_000 + createdMs / 1e10 };
    }

    let totalDiff = 0;
    let validCount = 0;
    let allSameCiclo = true;

    for (const venta of ventasActivas) {
      if (!venta.fechaFin) continue;
      const fechaFin = venta.fechaFin instanceof Date ? venta.fechaFin : new Date(venta.fechaFin as unknown as string);
      const diasExistente = Math.max(differenceInCalendarDays(fechaFin, hoy), 0);
      totalDiff += Math.abs(diasExistente - diasRestantesNuevo);
      validCount++;
      if (venta.cicloPago !== planCicloPago) allSameCiclo = false;
    }

    if (validCount === 0) {
      return { servicio, score: 500_000 + slotsDisponibles };
    }

    const diferenciaPromedio = totalDiff / validCount;
    const cicloBonus = allSameCiclo ? 5 : 0;
    const score = -(diferenciaPromedio - cicloBonus) + slotsDisponibles * 0.01;

    return { servicio, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.servicio);
}
