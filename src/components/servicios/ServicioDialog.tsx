"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Servicio, Categoria } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useServiciosStore } from "@/store/serviciosStore";
import { toast } from "sonner";

const servicioSchema = z.object({
  categoriaId: z.string().min(1, "La categoría es requerida"),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.string().min(1, "El tipo de plan es requerido"),
  correo: z.string().email("Correo electrónico inválido"),
  contrasena: z
    .string()
    .min(4, "La contraseña debe tener al menos 4 caracteres"),
  perfilesDisponibles: z.number().min(1, "Debe haber al menos 1 perfil"),
  costoServicio: z.number().min(0.01, "El costo debe ser mayor a 0"),
  renovacionAutomatica: z.boolean(),
  fechaRenovacion: z.date().optional(),
});

type ServicioFormData = z.infer<typeof servicioSchema>;

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
  } = useForm<ServicioFormData>({
    resolver: zodResolver(servicioSchema),
    defaultValues: {
      categoriaId: "",
      nombre: "",
      tipo: "",
      correo: "",
      contrasena: "",
      perfilesDisponibles: 1,
      costoServicio: 0,
      renovacionAutomatica: false,
    },
  });

  const tipoValue = watch("tipo");
  const perfilesDisponiblesValue = watch("perfilesDisponibles");
  const costoServicioValue = watch("costoServicio");
  const renovacionAutomaticaValue = watch("renovacionAutomatica");
  const categoriaIdValue = watch("categoriaId");

  // Calculate total cost
  const costoTotal = costoServicioValue * perfilesDisponiblesValue;

  useEffect(() => {
    if (servicio) {
      reset({
        categoriaId: servicio.categoriaId,
        nombre: servicio.nombre,
        tipo: servicio.tipo,
        correo: servicio.correo,
        contrasena: servicio.contrasena,
        perfilesDisponibles: servicio.perfilesDisponibles,
        costoServicio: servicio.costoServicio,
        renovacionAutomatica: servicio.renovacionAutomatica,
        fechaRenovacion: servicio.fechaRenovacion,
      });
    } else {
      reset({
        categoriaId: "",
        nombre: "",
        tipo: "",
        correo: "",
        contrasena: "",
        perfilesDisponibles: 1,
        costoServicio: 0,
        renovacionAutomatica: false,
      });
    }
  }, [servicio, reset]);

  const tiposPlanesDinamicos = useMemo(() => {
    const cat = categorias.find((c) => c.id === categoriaIdValue);
    return cat?.tiposPlanes || [];
  }, [categorias, categoriaIdValue]);

  const onSubmit = async (data: ServicioFormData) => {
    try {
      const categoria = categorias.find((c) => c.id === data.categoriaId);
      const tipoPlanSeleccionado = categoria?.tiposPlanes?.find(
        (tipo) => tipo.id === data.tipo,
      );

      if (!tipoPlanSeleccionado) {
        toast.error("Seleccione un tipo de plan configurado para la categoría");
        return;
      }

      const servicioData = {
        ...data,
        activo: servicio?.activo ?? true,
        createdBy: servicio?.createdBy || "current-user",
        categoriaNombre: categoria?.nombre || "",
        tipoNombre: tipoPlanSeleccionado.nombre,
        gastosTotal: servicio?.gastosTotal ?? 0, // Preservar o inicializar campo denormalizado
      };

      if (servicio) {
        await updateServicio(servicio.id, servicioData);
        toast.success("Servicio actualizado", {
          description:
            "Los datos del servicio han sido guardados correctamente.",
          duration: 3000,
        });
      } else {
        await createServicio(servicioData);
        toast.success("Servicio creado", {
          description:
            "El nuevo servicio ha sido registrado correctamente en el sistema.",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{servicio ? "Editar" : "Nuevo"} Servicio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoriaId">Categoría</Label>
              <Select
                value={categoriaIdValue}
                onValueChange={(value) => {
                  setValue("categoriaId", value);
                  setValue("tipo", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay categorías
                    </div>
                  ) : (
                    categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.categoriaId && (
                <p className="text-sm text-red-500">
                  {errors.categoriaId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Servicio</Label>
              <Input
                id="nombre"
                {...register("nombre")}
                placeholder="Ej: Netflix Premium"
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              value={tipoValue}
              onValueChange={(value) => setValue("tipo", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposPlanesDinamicos.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Selecciona una categoría con tipos de plan
                  </div>
                ) : (
                  tiposPlanesDinamicos.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="correo">Correo Electrónico</Label>
              <Input
                id="correo"
                type="email"
                {...register("correo")}
                placeholder="cuenta@servicio.com"
              />
              {errors.correo && (
                <p className="text-sm text-red-500">{errors.correo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <Input
                id="contrasena"
                type="text"
                {...register("contrasena")}
                placeholder="Contraseña de la cuenta"
              />
              {errors.contrasena && (
                <p className="text-sm text-red-500">
                  {errors.contrasena.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perfilesDisponibles">Perfiles Disponibles</Label>
              <Input
                id="perfilesDisponibles"
                type="number"
                min="1"
                {...register("perfilesDisponibles", { valueAsNumber: true })}
                disabled={false}
              />
              {errors.perfilesDisponibles && (
                <p className="text-sm text-red-500">
                  {errors.perfilesDisponibles.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="costoServicio">Costo del Servicio</Label>
              <Input
                id="costoServicio"
                type="number"
                step="0.01"
                min="0"
                {...register("costoServicio", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.costoServicio && (
                <p className="text-sm text-red-500">
                  {errors.costoServicio.message}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Costo Total Mensual:</span>
              <span className="text-2xl font-bold">
                ${costoTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="renovacionAutomatica">
                Renovación Automática
              </Label>
              <p className="text-sm text-muted-foreground">
                El servicio se renovará automáticamente
              </p>
            </div>
            <Switch
              id="renovacionAutomatica"
              checked={Boolean(renovacionAutomaticaValue)}
              onCheckedChange={(checked) =>
                setValue("renovacionAutomatica", checked)
              }
            />
          </div>

          {renovacionAutomaticaValue && (
            <div className="space-y-2">
              <Label htmlFor="fechaRenovacion">Fecha de Renovación</Label>
              <Input
                id="fechaRenovacion"
                type="date"
                {...register("fechaRenovacion", { valueAsDate: true })}
              />
            </div>
          )}

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
