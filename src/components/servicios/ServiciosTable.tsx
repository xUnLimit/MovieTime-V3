"use client";

import { useState, useMemo, useCallback } from "react";
import { Servicio } from "@/types";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, Copy } from "lucide-react";
import { useServiciosStore } from "@/store/serviciosStore";
import { useCategoriasStore } from "@/store/categoriasStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

interface ServiciosTableProps {
  servicios: Servicio[];
  onEdit: (servicio: Servicio) => void;
}

export function ServiciosTable({ servicios, onEdit }: ServiciosTableProps) {
  const { deleteServicio, fetchCounts } = useServiciosStore();
  const { fetchCategorias } = useCategoriasStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [servicioToDelete, setServicioToDelete] = useState<Servicio | null>(
    null,
  );
  const [deletePayments, setDeletePayments] = useState(false);

  const handleDelete = (servicio: Servicio) => {
    setServicioToDelete(servicio);
    setDeletePayments(false); // Reset checkbox
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (servicioToDelete) {
      try {
        await deleteServicio(servicioToDelete.id, deletePayments);

        if (deletePayments) {
          toast.success("Servicio eliminado", {
            description:
              "El servicio y todos sus registros de pago han sido eliminados.",
          });
        } else {
          toast.success("Servicio eliminado", {
            description:
              "El servicio fue eliminado. Los registros de pago se conservaron.",
          });
        }

        // Refrescar categorías y contadores de servicios para actualizar widgets
        await Promise.all([
          fetchCategorias(true),
          fetchCounts(true), // Force refresh para actualizar inmediatamente
        ]);
      } catch (error) {
        toast.error("Error al eliminar servicio", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const handleCopyCredentials = useCallback((servicio: Servicio) => {
    const text = `Correo: ${servicio.correo}\nContraseña: ${servicio.contrasena}`;
    navigator.clipboard.writeText(text);
    toast.success("Credenciales copiadas", {
      description: "El correo y contraseña han sido copiados al portapapeles.",
    });
  }, []);

  const columns: Column<Servicio>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Servicio",
        sortable: true,
        render: (item) => (
          <div>
            <div className="font-medium">{item.nombre}</div>
            <div className="text-sm text-muted-foreground">
              {item.categoriaNombre}
            </div>
          </div>
        ),
      },
      {
        key: "tipo",
        header: "Tipo",
        sortable: true,
        render: (item) => {
          const label = item.tipoNombre || item.tipo;
          return (
            <Badge variant="secondary">{label}</Badge>
          );
        },
      },
      {
        key: "perfiles",
        header: "Perfiles",
        render: (item) => {
          // Si el servicio está inactivo, mostrar barra vacía y 0 disponibles
          const ocupados = !item.activo ? 0 : item.perfilesOcupados;
          const porcentaje = !item.activo
            ? 0
            : (item.perfilesOcupados / item.perfilesDisponibles) * 100;
          return (
            <div className="w-32">
              <div className="flex justify-between text-sm mb-1">
                <span className={!item.activo ? "text-gray-600" : ""}>
                  {ocupados}
                </span>
                <span
                  className={
                    !item.activo ? "text-gray-600" : "text-muted-foreground"
                  }
                >
                  de {item.perfilesDisponibles}
                </span>
              </div>
              <Progress
                value={porcentaje}
                className={`h-2 ${!item.activo ? "opacity-50" : ""}`}
              />
            </div>
          );
        },
      },
      {
        key: "correo",
        header: "Credenciales",
        render: (item) => (
          <div className="flex items-center gap-2">
            <div className="text-sm">
              <div className="text-sm">{item.correo}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCredentials(item);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
      {
        key: "costoServicio",
        header: "Costo",
        sortable: true,
        render: (item) => (
          <div>
            <div className="font-medium">
              ${(item.costoServicio * item.perfilesDisponibles).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              ${item.costoServicio.toFixed(2)}/perfil
            </div>
          </div>
        ),
      },
      {
        key: "activo",
        header: "Estado",
        render: (item) => (
          <Badge
            variant="outline"
            className={
              item.activo
                ? "border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                : "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
            }
          >
            {item.activo ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
    ],
    [handleCopyCredentials],
  );

  return (
    <>
      <DataTable
        data={servicios as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        actions={(item) => {
          const servicio = item as unknown as Servicio;
          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(servicio)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(servicio)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Servicio"
        description={`¿Estás seguro de que quieres eliminar el servicio "${servicioToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      >
        <div className="flex items-start space-x-2">
          <Checkbox
            id="delete-payments"
            checked={deletePayments}
            onCheckedChange={(checked) => setDeletePayments(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="delete-payments"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Eliminar también los registros de pago
            </Label>
            <p className="text-sm text-muted-foreground">
              Al marcar esta opción, se eliminarán todos los registros de pago
              de la base de datos. Si no se marca, se conservarán para
              historial.
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
