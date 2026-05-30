"use client";

import { useMemo } from "react";

import {
  useVentaPerfilDetalle,
  type PendingVentaPerfil,
} from "@/components/ventas/form/useVentaPerfilDetalle";
import type { VentaItem } from "@/features/ventas/ventas-form-shared";
import { getCurrencySymbol } from "@/platform/constants";
import {
  calculateDiscountedAmount,
  roundToDecimals,
} from "@/platform/utils/calculations";
import type { MetodoPago, Tercero } from "@/types";

interface UseVentaCreateComputedStateParams {
  clienteSeleccionado?: Tercero;
  descuento: string;
  items: VentaItem[];
  metodoPagoSeleccionado?: Pick<MetodoPago, "moneda">;
  precio: string;
}

export function useVentaCreateComputedState({
  clienteSeleccionado,
  descuento,
  items,
  metodoPagoSeleccionado,
  precio,
}: UseVentaCreateComputedStateParams) {
  const clientePendienteNombre = useMemo(() => {
    if (!clienteSeleccionado) return "Cliente pendiente";
    return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim();
  }, [clienteSeleccionado]);

  const perfilesPendientesDetalle = useMemo<PendingVentaPerfil[]>(() => {
    return items
      .filter((item) => item.perfilNumero)
      .map((item) => ({
        servicioId: item.servicioId,
        perfilNumero: item.perfilNumero as number,
        clienteNombre: clientePendienteNombre,
        perfilNombre:
          item.perfilNombre?.trim() || `Perfil ${item.perfilNumero}`,
      }));
  }, [items, clientePendienteNombre]);

  const perfilDetalle = useVentaPerfilDetalle(perfilesPendientesDetalle);

  const simboloMoneda = getCurrencySymbol(metodoPagoSeleccionado?.moneda);
  const precioBase = roundToDecimals(Number(precio) || 0);
  const descuentoNumero = roundToDecimals(Number(descuento) || 0);
  const precioFinalNumero = calculateDiscountedAmount(
    precioBase,
    descuentoNumero,
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.precio, 0),
    [items],
  );
  const totalFinal = useMemo(
    () => items.reduce((sum, item) => sum + item.precioFinal, 0),
    [items],
  );

  return {
    descuentoNumero,
    perfilDetalle,
    precioBase,
    precioFinalNumero,
    simboloMoneda,
    subtotal,
    totalFinal,
  };
}
