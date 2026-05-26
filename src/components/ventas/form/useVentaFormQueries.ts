"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { queryMetodosPagoTercerosUseCase } from "@/lib/use-cases/metodos-pago-use-cases";
import { queryServiciosByCategoriaUseCase } from "@/lib/use-cases/servicios/servicios-query-use-cases";
import { queryVentasActivasByServiciosUseCase } from "@/lib/use-cases/ventas/ventas-query-use-cases";
import {
  PENDING_TERCERO_PAYMENT_CURRENCY,
  PENDING_TERCERO_PAYMENT_ID,
  PENDING_TERCERO_PAYMENT_NAME,
  withPendingTerceroPaymentMethod,
} from "@/lib/utils/terceroMetodoPago";
import type { MetodoPagoTerceroOption } from "@/features/ventas/ventas-form-shared";
import type { VentaDoc } from "@/types";

const PENDING_METODO_PAGO_TERCERO_OPTION: MetodoPagoTerceroOption = {
  id: PENDING_TERCERO_PAYMENT_ID,
  nombre: PENDING_TERCERO_PAYMENT_NAME,
  asociadoA: "tercero",
  moneda: PENDING_TERCERO_PAYMENT_CURRENCY,
};

interface VentasActivasByServicio {
  ventasActivasPorServicio: Record<string, VentaDoc[]>;
  perfilesOcupadosVenta: Record<string, Set<number>>;
}

function buildVentasActivasByServicio(
  serviciosIds: string[],
  ventas: VentaDoc[],
  excludeVentaId?: string,
): VentasActivasByServicio {
  const candidateSet = new Set(serviciosIds);
  const grouped: Record<string, VentaDoc[]> = Object.fromEntries(
    serviciosIds.map((id) => [id, []]),
  );

  ventas.forEach((venta) => {
    if (excludeVentaId && venta.id === excludeVentaId) return;
    if (!candidateSet.has(venta.servicioId)) return;
    grouped[venta.servicioId].push(venta);
  });

  return {
    ventasActivasPorServicio: grouped,
    perfilesOcupadosVenta: Object.fromEntries(
      Object.entries(grouped).map(([servicioId, ventasServicio]) => [
        servicioId,
        new Set(
          ventasServicio
            .map((venta) => venta.perfilNumero)
            .filter((numero): numero is number => numero != null),
        ),
      ]),
    ),
  };
}

export function useMetodosPagoTercerosOptions() {
  return useQuery({
    queryKey: queryKeys.metodosPago.tercerosOptions(),
    queryFn: async () => {
      const metodos = await queryMetodosPagoTercerosUseCase();
      const options = metodos.map((metodo): MetodoPagoTerceroOption => ({
        id: metodo.id,
        nombre: metodo.nombre,
        asociadoA: metodo.asociadoA ?? "tercero",
        moneda: metodo.moneda,
      }));

      return [PENDING_METODO_PAGO_TERCERO_OPTION, ...options];
    },
  });
}

export function useMetodosPagoTercerosWithPending() {
  return useQuery({
    queryKey: queryKeys.metodosPago.tercerosWithPending(),
    queryFn: async () => {
      const metodos = await queryMetodosPagoTercerosUseCase();

      return withPendingTerceroPaymentMethod(metodos);
    },
  });
}

export function useServiciosByCategoria(categoriaId: string) {
  return useQuery({
    queryKey: queryKeys.servicios.byCategoria(categoriaId || "invalid"),
    queryFn: () =>
      queryServiciosByCategoriaUseCase(categoriaId),
    enabled: Boolean(categoriaId),
  });
}

export function useVentasActivasByServicio(
  servicioIds: string[],
  options: { excludeVentaId?: string } = {},
) {
  const serviciosKey = useMemo(
    () => [...servicioIds].sort().join("|"),
    [servicioIds],
  );

  const query = useQuery({
    queryKey: queryKeys.ventas.activeByServicios(serviciosKey || "empty", options.excludeVentaId),
    queryFn: async () => {
      if (servicioIds.length === 0) {
        return buildVentasActivasByServicio([], [], options.excludeVentaId);
      }

      const ventas = await queryVentasActivasByServiciosUseCase<VentaDoc>(servicioIds);

      return buildVentasActivasByServicio(servicioIds, ventas, options.excludeVentaId);
    },
    enabled: servicioIds.length > 0,
  });

  return {
    ...query,
    ventasActivasPorServicio: query.data?.ventasActivasPorServicio ?? {},
    perfilesOcupadosVenta: query.data?.perfilesOcupadosVenta ?? {},
  };
}
