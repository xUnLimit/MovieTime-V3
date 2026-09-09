import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import { reportError } from "@/platform/observability/logger";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import type { Categoria, Plan, TipoPlanConfig } from "@/types";

import {
  getCreatePlanesValidationError,
  type CategoriaFormData,
} from "./categoria-form-helpers";

type CreateCategoria = (
  categoria: Omit<Categoria, "id" | "createdAt" | "updatedAt">,
) => Promise<void>;

type UpdateCategoria = (
  id: string,
  updates: Partial<Categoria>,
) => Promise<void>;

interface UseCategoriaFormSubmitArgs {
  categoria?: Categoria;
  createCategoria: CreateCategoria;
  mode: "create" | "edit";
  planes: Plan[];
  returnTo: string;
  router: AppRouterInstance;
  setActiveTab: (tab: string) => void;
  setPlanesError: (error: string) => void;
  tiposPlanes: TipoPlanConfig[];
  updateCategoria: UpdateCategoria;
}

export function useCategoriaFormSubmit({
  categoria,
  createCategoria,
  mode,
  planes,
  returnTo,
  router,
  setActiveTab,
  setPlanesError,
  tiposPlanes,
  updateCategoria,
}: UseCategoriaFormSubmitArgs) {
  return async function onSubmit(data: CategoriaFormData) {
    if (mode === "create") {
      const planesValidationError = getCreatePlanesValidationError(
        tiposPlanes,
        planes,
      );
      if (planesValidationError) {
        setPlanesError(planesValidationError);
        setActiveTab("planes");
        return;
      }
    }

    try {
      setPlanesError("");
      if (mode === "create") {
        await createCategoria({
          nombre: data.nombre,
          tipo: data.tipo,
          tipoCategoria: data.tipoCategoria,
          notas: data.notas || "",
          tiposPlanes,
          planes,
          activo: true,
          totalServicios: 0,
          serviciosActivos: 0,
          perfilesDisponiblesTotal: 0,
          ventasTotales: 0,
          ingresosTotales: 0,
          gastosTotal: 0,
        });
        toast.success("Categoria creada", {
          description: "La nueva categoria ha sido registrada correctamente.",
        });
      } else if (categoria) {
        await updateCategoria(categoria.id, {
          nombre: data.nombre,
          tipo: data.tipo,
          tipoCategoria: data.tipoCategoria,
          tiposPlanes,
          planes,
          notas: data.notas,
          activo: categoria.activo,
        });
        toast.success("Categoria actualizada", {
          description:
            "Los cambios en la categoria han sido guardados correctamente.",
        });
      }
      router.push(returnTo);
    } catch (error) {
      const message =
        mode === "create"
          ? "Error al crear la categoria"
          : "Error al actualizar la categoria";
      toast.error(message, {
        description: getPublicErrorMessage(error, "No se pudo guardar la categoría."),
      });
      reportError("CategoriaFormSubmit", message, error);
    }
  };
}
