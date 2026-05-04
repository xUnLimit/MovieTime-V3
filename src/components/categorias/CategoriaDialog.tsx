"use client";

import { useEffect } from "react";
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
import { Categoria } from "@/types";
import { useCategoriasStore } from "@/store/categoriasStore";
import { toast } from "sonner";

const categoriaSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["cliente", "revendedor", "ambos"]),
  iconUrl: z.string().optional(),
  color: z.string().optional(),
  activo: z.boolean(),
});

type CategoriaFormData = z.infer<typeof categoriaSchema>;

interface CategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria: Categoria | null;
}

export function CategoriaDialog({
  open,
  onOpenChange,
  categoria,
}: CategoriaDialogProps) {
  const { createCategoria, updateCategoria } = useCategoriasStore();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: {
      nombre: "",
      tipo: "cliente",
      iconUrl: "",
      color: "#000000",
      activo: true,
    },
  });

  const tipoValue = watch("tipo");
  const activoValue = watch("activo");

  useEffect(() => {
    if (categoria) {
      reset({
        nombre: categoria.nombre,
        tipo: categoria.tipo,
        iconUrl: categoria.iconUrl || "",
        color: categoria.color || "#000000",
        activo: categoria.activo,
      });
    } else {
      reset({
        nombre: "",
        tipo: "cliente",
        iconUrl: "",
        color: "#000000",
        activo: true,
      });
    }
  }, [categoria, reset]);

  const onSubmit = async (data: CategoriaFormData) => {
    try {
      if (categoria) {
        await updateCategoria(categoria.id, data);
        toast.success("Categoría actualizada", {
          description:
            "Los cambios en la categoría han sido guardados correctamente.",
        });
      } else {
        // Inicializar campos denormalizados para nueva categoría
        await createCategoria({
          ...data,
          totalServicios: 0,
          serviciosActivos: 0,
          perfilesDisponiblesTotal: 0,
          ventasTotales: 0,
          ingresosTotales: 0,
          gastosTotal: 0,
        });
        toast.success("Categoría creada", {
          description: "La nueva categoría ha sido registrada correctamente.",
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Error al guardar categoría", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar" : "Nueva"} Categoría</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              {...register("nombre")}
              placeholder="Ej: Netflix, Spotify"
            />
            {errors.nombre && (
              <p className="text-sm text-red-500">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              value={tipoValue}
              onValueChange={(value) =>
                setValue("tipo", value as "cliente" | "revendedor" | "ambos")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="revendedor">Revendedor</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && (
              <p className="text-sm text-red-500">{errors.tipo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="iconUrl">Ícono (opcional)</Label>
            <Input
              id="iconUrl"
              {...register("iconUrl")}
              placeholder="Ej: 📺, 🎵, 🎮"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                {...register("color")}
                className="w-20"
              />
              <Input
                {...register("color")}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="activo">Activo</Label>
            <Switch
              id="activo"
              checked={activoValue}
              onCheckedChange={(checked) => setValue("activo", checked)}
            />
          </div>

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
