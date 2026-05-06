import { useMemo } from "react";

import type { Usuario } from "@/types";
import type { PendingVentaPerfil } from "@/components/ventas/form/useVentaPerfilDetalle";

interface UseVentaEditProfilePendingDataParams {
  clienteSeleccionado?: Usuario;
  ventaClienteNombre: string;
  perfilNumeroValue?: string;
  perfilNombreValue?: string;
  servicioIdValue: string;
}

export function useVentaEditProfilePendingData({
  clienteSeleccionado,
  ventaClienteNombre,
  perfilNumeroValue,
  perfilNombreValue,
  servicioIdValue,
}: UseVentaEditProfilePendingDataParams) {
  const clienteDetalleNombre = useMemo(() => {
    if (clienteSeleccionado) {
      return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim();
    }
    return ventaClienteNombre || "Cliente pendiente";
  }, [clienteSeleccionado, ventaClienteNombre]);

  const perfilesPendientesDetalle = useMemo<PendingVentaPerfil[]>(() => {
    const numero = Number(perfilNumeroValue);
    if (!numero || !servicioIdValue) return [];

    return [
      {
        servicioId: servicioIdValue,
        perfilNumero: numero,
        clienteNombre: clienteDetalleNombre,
        perfilNombre: perfilNombreValue?.trim() || `Perfil ${numero}`,
      },
    ];
  }, [
    clienteDetalleNombre,
    perfilNombreValue,
    perfilNumeroValue,
    servicioIdValue,
  ]);

  return {
    clienteDetalleNombre,
    perfilesPendientesDetalle,
  };
}
