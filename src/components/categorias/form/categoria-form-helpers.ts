import { z } from "@/platform/validation/zod";

import type { Categoria, Plan, TipoPlanConfig } from "@/types";

export const categoriaSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["cliente", "revendedor"], {
    message: "Debe seleccionar asociado a",
  }),
  tipoCategoria: z.enum(["plataforma_streaming", "otros"], {
    message: "Debe seleccionar un tipo de categoría",
  }),
  notas: z.string().optional(),
});

export type CategoriaFormData = z.infer<typeof categoriaSchema>;

export function getCicloPagoLabel(ciclo: string) {
  switch (ciclo) {
    case "mensual":
      return "Mensual";
    case "trimestral":
      return "Trimestral";
    case "semestral":
      return "Semestral";
    case "anual":
      return "Anual";
    default:
      return "Seleccionar período";
  }
}

export function getAsociadoLabel(tipo: string) {
  switch (tipo) {
    case "cliente":
      return "Cliente";
    case "revendedor":
      return "Revendedor";
    default:
      return "Seleccionar";
  }
}

export function getTipoCategoriaLabel(tipo: string) {
  switch (tipo) {
    case "plataforma_streaming":
      return "Plataforma de Streaming";
    case "otros":
      return "Otros";
    default:
      return "Seleccionar tipo";
  }
}

export function getCreatePlanesValidationError(
  tiposPlanes: TipoPlanConfig[],
  planes: Plan[],
) {
  if (tiposPlanes.length === 0) {
    return "Debe crear al menos un tipo de plan";
  }
  if (planes.length === 0) {
    return "Debe agregar al menos un plan a la categoría";
  }
  if (planes.some((plan) => !plan.nombre || plan.nombre.trim() === "")) {
    return "Todos los planes deben tener un nombre";
  }
  return "";
}

interface HasCategoriaChangesArgs {
  categoria?: Categoria;
  mode: "create" | "edit";
  nombreValue?: string;
  notasValue?: string;
  planes: Plan[];
  tipoCategoriaValue?: string;
  tipoValue?: string;
  tiposPlanes: TipoPlanConfig[];
}

export function hasCategoriaChanges({
  categoria,
  mode,
  nombreValue,
  notasValue,
  planes,
  tipoCategoriaValue,
  tipoValue,
  tiposPlanes,
}: HasCategoriaChangesArgs) {
  if (mode !== "edit" || !categoria) return true;

  const originalPlanes = categoria.planes || [];
  const originalTipos = categoria.tiposPlanes || [];

  if (nombreValue !== categoria.nombre) return true;
  if (tipoValue !== categoria.tipo) return true;
  if (tipoCategoriaValue !== categoria.tipoCategoria) return true;
  if ((notasValue || "") !== (categoria.notas || "")) return true;
  if (tiposPlanes.length !== originalTipos.length) return true;
  if (planes.length !== originalPlanes.length) return true;

  for (let i = 0; i < tiposPlanes.length; i++) {
    const curr = tiposPlanes[i];
    const orig = originalTipos[i];
    if (!orig || curr.id !== orig.id || curr.nombre !== orig.nombre) {
      return true;
    }
  }

  for (let i = 0; i < planes.length; i++) {
    const curr = planes[i];
    const orig = originalPlanes[i];
    if (
      !orig ||
      curr.id !== orig.id ||
      curr.nombre !== orig.nombre ||
      curr.precio !== orig.precio ||
      curr.cicloPago !== orig.cicloPago ||
      curr.tipoPlan !== orig.tipoPlan
    ) {
      return true;
    }
  }

  return false;
}
