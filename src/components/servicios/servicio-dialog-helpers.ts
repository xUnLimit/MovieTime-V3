import * as z from "zod";

import type { Categoria, Servicio } from "@/types";

export const servicioDialogSchema = z.object({
  categoriaId: z.string().min(1, "La categoria es requerida"),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.string().min(1, "El tipo de plan es requerido"),
  correo: z.string().email("Correo electronico invalido"),
  contrasena: z.string().min(4, "La contrasena debe tener al menos 4 caracteres"),
  perfilesDisponibles: z.number().min(1, "Debe haber al menos 1 perfil"),
  costoServicio: z.number().min(0.01, "El costo debe ser mayor a 0"),
  renovacionAutomatica: z.boolean(),
  fechaRenovacion: z.date().optional(),
});

export type ServicioDialogFormData = z.infer<typeof servicioDialogSchema>;

export const SERVICIO_DIALOG_DEFAULT_VALUES: ServicioDialogFormData = {
  categoriaId: "",
  nombre: "",
  tipo: "",
  correo: "",
  contrasena: "",
  perfilesDisponibles: 1,
  costoServicio: 0,
  renovacionAutomatica: false,
};

export function getServicioDialogResetValues(servicio: Servicio | null): ServicioDialogFormData {
  if (!servicio) return SERVICIO_DIALOG_DEFAULT_VALUES;

  return {
    categoriaId: servicio.categoriaId,
    nombre: servicio.nombre,
    tipo: servicio.tipo,
    correo: servicio.correo,
    contrasena: servicio.contrasena,
    perfilesDisponibles: servicio.perfilesDisponibles,
    costoServicio: servicio.costoServicio,
    renovacionAutomatica: servicio.renovacionAutomatica,
    fechaRenovacion: servicio.fechaRenovacion,
  };
}

export function getTiposPlanesForCategoria(categorias: Categoria[], categoriaId: string) {
  return categorias.find((categoria) => categoria.id === categoriaId)?.tiposPlanes || [];
}

export function getCostoTotalServicio(costoServicio: number, perfilesDisponibles: number) {
  return costoServicio * perfilesDisponibles;
}

export function buildServicioDialogPayload({
  categorias,
  data,
  servicio,
}: {
  categorias: Categoria[];
  data: ServicioDialogFormData;
  servicio: Servicio | null;
}) {
  const categoria = categorias.find((item) => item.id === data.categoriaId);
  const tipoPlanSeleccionado = categoria?.tiposPlanes?.find((tipo) => tipo.id === data.tipo);

  if (!tipoPlanSeleccionado) return null;

  return {
    ...data,
    activo: servicio?.activo ?? true,
    createdBy: servicio?.createdBy || "current-user",
    categoriaNombre: categoria?.nombre || "",
    tipoNombre: tipoPlanSeleccionado.nombre,
    gastosTotal: servicio?.gastosTotal ?? 0,
  };
}
