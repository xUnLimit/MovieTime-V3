"use client";

import { useMemo } from "react";

import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import { getServicioMetodoPagoNombre } from "@/platform/utils/servicioMetodoPago";
import type { Categoria, MetodoPago, Servicio } from "@/types";

import { getSimboloMoneda } from "./servicio-form-helpers";

interface UseServicioFormHasChangesParams {
  categoriaId: string;
  cicloPago: ServicioFormData["cicloPago"];
  contrasena: string;
  correo: string;
  costoServicio: string;
  estado: ServicioFormData["estado"];
  fechaInicio: Date;
  fechaVencimiento: Date;
  metodoPagoId: string;
  nombre: string;
  notas: string;
  perfilesDisponibles: string;
  renovacionAutomatica: boolean;
  servicio?: Servicio;
  tipoPlan: string;
}

export function useServicioFormHasChanges({
  categoriaId,
  cicloPago,
  contrasena,
  correo,
  costoServicio,
  estado,
  fechaInicio,
  fechaVencimiento,
  metodoPagoId,
  nombre,
  notas,
  perfilesDisponibles,
  renovacionAutomatica,
  servicio,
  tipoPlan,
}: UseServicioFormHasChangesParams) {
  return useMemo(() => {
    if (!servicio?.id) return true;

    return (
      nombre !== servicio.nombre ||
      correo !== servicio.correo ||
      contrasena !== servicio.contrasena ||
      categoriaId !== servicio.categoriaId ||
      tipoPlan !== servicio.tipo ||
      metodoPagoId !== (servicio.metodoPagoId || "") ||
      Number(costoServicio) !== Number(servicio.costoServicio ?? 0) ||
      String(perfilesDisponibles) !== String(servicio.perfilesDisponibles || 1) ||
      cicloPago !== (servicio.cicloPago || "mensual") ||
      estado !==
        (servicio.enReposo ? "reposo" : servicio.activo ? "activo" : "inactivo") ||
      renovacionAutomatica !== (servicio.renovacionAutomatica ?? false) ||
      notas !== (servicio.notas || "") ||
      fechaInicio?.getTime() !== servicio.fechaInicio?.getTime() ||
      fechaVencimiento?.getTime() !== servicio.fechaVencimiento?.getTime()
    );
  }, [
    categoriaId,
    cicloPago,
    contrasena,
    correo,
    costoServicio,
    estado,
    fechaInicio,
    fechaVencimiento,
    metodoPagoId,
    nombre,
    notas,
    perfilesDisponibles,
    renovacionAutomatica,
    servicio,
    tipoPlan,
  ]);
}

interface UseServicioFormDerivedStateParams {
  categoriaId: string;
  categorias: Categoria[];
  metodoPagoId: string;
  metodosPago: MetodoPago[];
}

export function useServicioFormDerivedState({
  categoriaId,
  categorias,
  metodoPagoId,
  metodosPago,
}: UseServicioFormDerivedStateParams) {
  const categoriaSeleccionada = useMemo(
    () => categorias.find((categoria) => categoria.id === categoriaId),
    [categorias, categoriaId],
  );

  const categoriaNombre =
    categoriaSeleccionada?.nombre ?? "Seleccionar categoria";

  const tiposPlanesDinamicos = useMemo(
    () => categoriaSeleccionada?.tiposPlanes || [],
    [categoriaSeleccionada],
  );

  const metodoPagoSeleccionado = metodoPagoId
    ? metodosPago.find((metodo) => metodo.id === metodoPagoId)
    : null;

  const metodoPagoDisplayName = getServicioMetodoPagoNombre(
    metodoPagoSeleccionado,
  );

  const simboloMoneda = metodoPagoSeleccionado
    ? getSimboloMoneda(
        metodoPagoSeleccionado.moneda,
        metodoPagoSeleccionado.pais,
      )
    : "$";

  const categoriasActivas = useMemo(
    () =>
      categorias
        .filter((categoria) => categoria.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );

  const metodosPagoActivos = useMemo(
    () =>
      metodosPago
        .filter((metodo) => metodo.activo && metodo.asociadoA === "servicio")
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [metodosPago],
  );

  return {
    categoriaNombre,
    categoriasActivas,
    categoriaSeleccionada,
    metodoPagoDisplayName,
    metodoPagoSeleccionado,
    metodosPagoActivos,
    simboloMoneda,
    tiposPlanesDinamicos,
  };
}
