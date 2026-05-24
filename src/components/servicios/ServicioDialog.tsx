"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryKeys } from "@/lib/query-keys";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Categoria, Servicio } from "@/types";
import { ServicioDialogFields } from "./ServicioDialogFields";
import {
  buildServicioDialogPayload,
  getCostoTotalServicio,
  getServicioDialogResetValues,
  getTiposPlanesForCategoria,
  SERVICIO_DIALOG_DEFAULT_VALUES,
  servicioDialogSchema,
  type ServicioDialogFormData,
} from "./servicio-dialog-helpers";

interface ServicioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicio: Servicio | null;
  categorias: Categoria[];
}

export function ServicioDialog({
  open,
  onOpenChange,
  servicio,
  categorias,
}: ServicioDialogProps) {
  const queryClient = useQueryClient();
  const { createServicio, updateServicio } = useServiciosStore();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServicioDialogFormData>({
    resolver: zodResolver(servicioDialogSchema),
    defaultValues: SERVICIO_DIALOG_DEFAULT_VALUES,
  });

  const tipoValue = watch("tipo");
  const perfilesDisponiblesValue = watch("perfilesDisponibles");
  const costoServicioValue = watch("costoServicio");
  const renovacionAutomaticaValue = watch("renovacionAutomatica");
  const categoriaIdValue = watch("categoriaId");

  const costoTotal = getCostoTotalServicio(
    costoServicioValue,
    perfilesDisponiblesValue,
  );

  useEffect(() => {
    reset(getServicioDialogResetValues(servicio));
  }, [servicio, reset]);

  const tiposPlanesDinamicos = useMemo(
    () => getTiposPlanesForCategoria(categorias, categoriaIdValue),
    [categorias, categoriaIdValue],
  );

  const onSubmit = async (data: ServicioDialogFormData) => {
    try {
      const servicioData = buildServicioDialogPayload({
        categorias,
        data,
        servicio,
      });

      if (!servicioData) {
        toast.error("Seleccione un tipo de plan configurado para la categoria");
        return;
      }

      if (servicio) {
        await updateServicio(servicio.id, servicioData);
        toast.success("Servicio actualizado", {
          description: "Los datos del servicio han sido guardados correctamente.",
          duration: 3000,
        });
      } else {
        await createServicio(servicioData);
        toast.success("Servicio creado", {
          description: "El nuevo servicio ha sido registrado correctamente en el sistema.",
          duration: 3000,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
      ]);

      onOpenChange(false);
    } catch (error) {
      toast.error("Error al guardar servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{servicio ? "Editar" : "Nuevo"} Servicio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ServicioDialogFields
            categorias={categorias}
            categoriaIdValue={categoriaIdValue}
            tipoValue={tipoValue}
            renovacionAutomaticaValue={renovacionAutomaticaValue}
            costoTotal={costoTotal}
            tiposPlanesDinamicos={tiposPlanesDinamicos}
            errors={errors}
            register={register}
            setValue={setValue}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
