import { useCallback, useMemo, useState } from "react";

import { fetchVentasByFiltersUseCase } from "@/lib/use-cases/ventas-use-cases";
import type {
  PerfilDetalleOcupado,
  PerfilDetalleVisual,
} from "@/features/ventas/ventas-form-shared";
import type { Servicio, VentaDoc } from "@/types";

export interface PendingVentaPerfil {
  servicioId: string;
  perfilNumero: number;
  clienteNombre: string;
  perfilNombre: string;
}

export function useVentaPerfilDetalle(pendingProfiles: PendingVentaPerfil[]) {
  const [perfilDetalleOpen, setPerfilDetalleOpen] = useState(false);
  const [servicioDetalle, setServicioDetalle] = useState<Servicio | null>(null);
  const [perfilesOcupadosDetalle, setPerfilesOcupadosDetalle] = useState<
    PerfilDetalleOcupado[]
  >([]);
  const [loadingPerfilesDetalle, setLoadingPerfilesDetalle] = useState(false);
  const [errorPerfilesDetalle, setErrorPerfilesDetalle] = useState<
    string | null
  >(null);

  const handleOpenPerfilDetalle = useCallback(async (servicio: Servicio) => {
    setServicioDetalle(servicio);
    setPerfilDetalleOpen(true);
    setLoadingPerfilesDetalle(true);
    setErrorPerfilesDetalle(null);
    try {
      const ventas = await fetchVentasByFiltersUseCase<VentaDoc>([
        { field: "servicioId", operator: "==", value: servicio.id },
      ]);

      const ocupadosPorPerfil = new Map<number, PerfilDetalleOcupado>();
      ventas.forEach((venta) => {
        const estado = venta.estado ?? "activo";
        if (estado === "inactivo") return;

        const perfilNumero = venta.perfilNumero ?? null;
        if (!perfilNumero) return;

        const existente = ocupadosPorPerfil.get(perfilNumero);
        const actualMs = venta.createdAt
          ? new Date(venta.createdAt).getTime()
          : 0;
        const existenteMs = existente?.createdAt
          ? new Date(existente.createdAt).getTime()
          : 0;

        if (!existente || actualMs >= existenteMs) {
          ocupadosPorPerfil.set(perfilNumero, {
            perfilNumero,
            clienteNombre: venta.clienteNombre || "Cliente sin nombre",
            perfilNombre: venta.perfilNombre || `Perfil ${perfilNumero}`,
            createdAt: venta.createdAt,
            fechaFin: venta.fechaFin ? new Date(venta.fechaFin as unknown as string) : undefined,
            cicloPago: venta.cicloPago,
          });
        }
      });

      setPerfilesOcupadosDetalle(Array.from(ocupadosPorPerfil.values()));
    } catch (error) {
      console.error("Error cargando detalle de perfiles:", error);
      setPerfilesOcupadosDetalle([]);
      setErrorPerfilesDetalle("No se pudo cargar el detalle de perfiles.");
    } finally {
      setLoadingPerfilesDetalle(false);
    }
  }, []);

  const perfilesPendientesDetalle = useMemo(() => {
    const map = new Map<
      number,
      { clienteNombre: string; perfilNombre: string }
    >();
    if (!servicioDetalle) return map;

    pendingProfiles.forEach((perfil) => {
      if (perfil.servicioId !== servicioDetalle.id) return;
      map.set(perfil.perfilNumero, {
        clienteNombre: perfil.clienteNombre,
        perfilNombre: perfil.perfilNombre,
      });
    });

    return map;
  }, [pendingProfiles, servicioDetalle]);

  const perfilesOcupadosDetalleMap = useMemo(() => {
    const map = new Map<number, PerfilDetalleOcupado>();
    perfilesOcupadosDetalle.forEach((perfil) => {
      map.set(perfil.perfilNumero, perfil);
    });
    return map;
  }, [perfilesOcupadosDetalle]);

  const totalPerfilesDetalle = Math.max(
    servicioDetalle?.perfilesDisponibles || 0,
    0,
  );

  const detallePerfilNumbers = useMemo(
    () => Array.from({ length: totalPerfilesDetalle }, (_, index) => index + 1),
    [totalPerfilesDetalle],
  );

  const perfilesDetalleVisual = useMemo<PerfilDetalleVisual[]>(() => {
    return detallePerfilNumbers.map((numero) => {
      const pendiente = perfilesPendientesDetalle.get(numero);
      const ocupado = perfilesOcupadosDetalleMap.get(numero);

      if (pendiente) {
        return {
          numero,
          estado: "pendiente",
          perfilNombre: pendiente.perfilNombre,
          clienteNombre: pendiente.clienteNombre,
        };
      }

      if (ocupado) {
        return {
          numero,
          estado: "ocupado",
          perfilNombre: ocupado.perfilNombre || `Perfil ${numero}`,
          clienteNombre: ocupado.clienteNombre,
          fechaFin: ocupado.fechaFin,
          cicloPago: ocupado.cicloPago,
        };
      }

      return {
        numero,
        estado: "disponible",
        perfilNombre: `Perfil ${numero}`,
      };
    });
  }, [
    detallePerfilNumbers,
    perfilesOcupadosDetalleMap,
    perfilesPendientesDetalle,
  ]);

  const resumenPerfilesDetalle = useMemo(() => {
    const pendientes = Array.from(perfilesPendientesDetalle.keys());
    const ocupados = Array.from(perfilesOcupadosDetalleMap.keys()).filter(
      (numero) => !perfilesPendientesDetalle.has(numero),
    );
    return {
      total: totalPerfilesDetalle,
      pendientes: pendientes.length,
      ocupados: ocupados.length,
      disponibles: Math.max(
        totalPerfilesDetalle - pendientes.length - ocupados.length,
        0,
      ),
    };
  }, [
    perfilesOcupadosDetalleMap,
    perfilesPendientesDetalle,
    totalPerfilesDetalle,
  ]);

  return {
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    perfilesDetalleVisual,
    resumenPerfilesDetalle,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    handleOpenPerfilDetalle,
  };
}
