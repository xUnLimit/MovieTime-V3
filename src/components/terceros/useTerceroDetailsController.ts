"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";

import { useVentasTercero } from "@/hooks/use-ventas-tercero";
import { queryKeys } from "@/lib/query-keys";
import { fetchServiciosByFiltersUseCase } from "@/lib/use-cases/servicios-use-cases";
import { useServiciosStore } from "@/store/serviciosStore";
import { useVentasStore } from "@/store/ventasStore";
import type { Tercero } from "@/types";

type TerceroServicioCredential = {
  correo: string;
  contrasena: string;
  nombre: string;
};

async function fetchServiciosCredentialsByIds(
  servicioIds: string[],
): Promise<Record<string, TerceroServicioCredential>> {
  const chunks: string[][] = [];
  for (let i = 0; i < servicioIds.length; i += 10) {
    chunks.push(servicioIds.slice(i, i + 10));
  }

  const allServicios = await Promise.all(
    chunks.map((chunk) =>
      fetchServiciosByFiltersUseCase<Record<string, unknown>>([
        { field: "__name__", operator: "in", value: chunk },
      ]),
    ),
  );

  return allServicios.flat().reduce<Record<string, TerceroServicioCredential>>(
    (acc, servicio) => {
      const servicioId = servicio.id as string;
      acc[servicioId] = {
        correo: (servicio.correo as string) || "—",
        contrasena: (servicio.contrasena as string) || "—",
        nombre: (servicio.nombre as string) || "Servicio",
      };
      return acc;
    },
    {},
  );
}

export function useTerceroDetailsController(usuario: Tercero) {
  const isRevendedor = usuario.tipo === "revendedor";
  const { ventas: ventasTercero, renovacionesByServicio } = useVentasTercero(
    usuario.id,
  );
  const updateVenta = useVentasStore((s) => s.updateVenta);
  const updateServicio = useServiciosStore((s) => s.updateServicio);
  const [estadoDialog, setEstadoDialog] = useState<{
    open: boolean;
    modo: "activar" | "inactivar";
    venta: {
      id: string;
      servicioId: string;
      categoriaNombre: string;
      servicioNombre: string;
    } | null;
  }>({ open: false, modo: "activar", venta: null });

  const handleWhatsApp = () => {
    const phone = usuario.telefono.replace(/\D/g, "");
    window.open(`https://web.whatsapp.com/send?phone=${phone}`, "_blank");
  };

  const handleCopy = async (value: string, label?: string) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label ? `${label} copiado` : "Copiado al portapapeles");
    } catch (error) {
      console.error("Error copiando:", error);
      toast.error("No se pudo copiar");
    }
  };

  const servicioIds = useMemo(
    () =>
      Array.from(new Set(ventasTercero.map((venta) => venta.servicioId).filter(Boolean))).sort(),
    [ventasTercero],
  );
  const serviciosKey = servicioIds.join("|");
  const { data: servicios = {} } = useQuery({
    queryKey: queryKeys.servicios.byIds(serviciosKey || "empty"),
    queryFn: () => fetchServiciosCredentialsByIds(servicioIds),
    enabled: servicioIds.length > 0,
  });

  const getCicloPagoLabel = (ciclo?: string) => {
    const labels: Record<string, string> = {
      mensual: "Mensual",
      trimestral: "Trimestral",
      semestral: "Semestral",
      anual: "Anual",
    };
    return ciclo ? labels[ciclo] || ciclo : "—";
  };

  const rows = useMemo(() => {
    const now = new Date();
    return ventasTercero.map((venta) => {
      const servicio = servicios[venta.servicioId];

      const totalDias =
        venta.fechaInicio && venta.fechaFin
          ? Math.max(
              differenceInCalendarDays(venta.fechaFin, venta.fechaInicio),
              0,
            )
          : 0;
      const diasRestantes = venta.fechaFin
        ? differenceInCalendarDays(venta.fechaFin, now)
        : 0;
      const ratioRestante =
        totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
      const montoSinConsumir =
        totalDias > 0 ? Math.max(venta.precioFinal * ratioRestante, 0) : 0;

      return {
        id: venta.id,
        categoriaNombre: venta.categoriaNombre, // <- Denormalizado
        servicioNombre: servicio?.nombre || venta.servicioNombre,
        servicioId: venta.servicioId,
        correo:
          venta.servicioCorreo !== "—"
            ? venta.servicioCorreo
            : servicio?.correo || "—",
        contrasena: servicio?.contrasena || "—",
        cicloPago: getCicloPagoLabel(venta.cicloPago),
        fechaInicio: venta.fechaInicio,
        fechaFin: venta.fechaFin,
        montoSinConsumir,
        renovaciones: renovacionesByServicio[venta.id] ?? 0,
        diasRestantes,
        cortadaAt: venta.cortadaAt ?? null,
        estado: venta.estado === "inactivo" ? "Inactivo" : "Activo",
        moneda: venta.moneda,
        perfilNumero: venta.perfilNumero,
      };
    });
  }, [ventasTercero, servicios, renovacionesByServicio]);

  const handleCambiarEstado = async (alcance: "venta" | "venta_y_servicio") => {
    const { modo, venta } = estadoDialog;
    if (!venta) return;
    const nuevoEstadoVenta = modo === "activar" ? "activo" : "inactivo";
    const nuevoActivoServicio = modo === "activar";
    try {
      await updateVenta(venta.id, { estado: nuevoEstadoVenta });
      if (alcance === "venta_y_servicio") {
        await updateServicio(venta.servicioId, { activo: nuevoActivoServicio });
      }
      toast.success(
        modo === "activar"
          ? "Venta activada correctamente"
          : "Venta inactivada correctamente",
      );
    } catch {
      toast.error("Ocurrió un error al cambiar el estado");
      throw new Error("cambio estado fallido");
    }
  };

  const abrirDialogEstado = (
    modo: "activar" | "inactivar",
    row: (typeof rows)[number],
  ) => {
    setEstadoDialog({
      open: true,
      modo,
      venta: {
        id: row.id,
        servicioId: row.servicioId,
        categoriaNombre: row.categoriaNombre,
        servicioNombre: row.servicioNombre,
      },
    });
  };


  const activeRows = useMemo(
    () => rows.filter((row) => row.estado === "Activo"),
    [rows],
  );
  const inactiveRows = useMemo(
    () => rows.filter((row) => row.estado === "Inactivo"),
    [rows],
  );

  return {
    isRevendedor,
    rows,
    activeRows,
    inactiveRows,
    estadoDialog,
    setEstadoDialog,
    handleWhatsApp,
    handleCopy,
    abrirDialogEstado,
    handleCambiarEstado,
  };
}

export type TerceroDetailsController = ReturnType<
  typeof useTerceroDetailsController
>;
export type TerceroDetailsRow = TerceroDetailsController["rows"][number];
