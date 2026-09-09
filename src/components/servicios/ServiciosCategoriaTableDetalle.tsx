"use client";

import { memo, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteServicioMutation } from "@/application/client-domain-mutations";
import { queryKeys } from "@/platform/query-keys";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import type { Servicio } from "@/types";
import { ServiciosCategoriaTableDetalleActions } from "./ServiciosCategoriaTableDetalleActions";
import { ServiciosCategoriaTableDetalleToolbar } from "./ServiciosCategoriaTableDetalleToolbar";

import {
  serviciosCategoriaColumnsForDataTable,
  toServicioCategoriaRow,
} from "./servicios-categoria-columns";

interface ServiciosCategoriaTableDetalleProps {
  servicios: Servicio[];
  onEdit: (id: string) => void;
  onView?: (id: string) => void;
  title?: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  cicloFilter: string;
  onCicloChange: (value: string) => void;
  perfilFilter: string;
  onPerfilChange: (value: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  hasPrevious?: boolean;
  page?: number;
  totalPages?: number;
  showPagination?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const ServiciosCategoriaTableDetalle = memo(
  function ServiciosCategoriaTableDetalle({
    servicios,
    onView,
    title = "Todos los servicios",
    searchTerm,
    onSearchChange,
    cicloFilter,
    onCicloChange,
    perfilFilter,
    onPerfilChange,
    isLoading = false,
    hasMore = false,
    hasPrevious = false,
    page = 1,
    totalPages = hasMore ? page + 1 : page,
    showPagination = true,
    pageSize = 10,
    onPageSizeChange,
    onNext,
    onPrevious,
  }: ServiciosCategoriaTableDetalleProps) {
    const queryClient = useQueryClient();
    const pathname = usePathname();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [servicioToDelete, setServicioToDelete] = useState<Servicio | null>(
      null,
    );
    const [deletePayments, setDeletePayments] = useState(false);

    const serviciosOrdenables = useMemo(
      () => servicios.map(toServicioCategoriaRow),
      [servicios],
    );

    const handleDelete = (servicio: Servicio) => {
      setServicioToDelete(servicio);
      setDeletePayments(false);
      setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
      if (!servicioToDelete) return;

      try {
        await deleteServicioMutation(servicioToDelete.id, deletePayments);

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

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
        ]);

        setDeleteDialogOpen(false);
        setServicioToDelete(null);
      } catch (error) {
        toast.error("Error al eliminar servicio", {
          description: getPublicErrorMessage(error, "No se pudo eliminar el servicio."),
        });
      }
    };

    return (
      <>
        <Card className="min-w-0 p-3 pb-2 sm:p-4 sm:pb-2">
          <h3 className="text-lg font-semibold sm:text-xl">{title}</h3>
          <ServiciosCategoriaTableDetalleToolbar
            cicloFilter={cicloFilter}
            onCicloChange={onCicloChange}
            onPerfilChange={onPerfilChange}
            onSearchChange={onSearchChange}
            perfilFilter={perfilFilter}
            searchTerm={searchTerm}
          />

          <div>
            <DataTable
              data={serviciosOrdenables}
              columns={serviciosCategoriaColumnsForDataTable}
              emptyMessage="No hay servicios para mostrar"
              loading={isLoading}
              pagination={false}
              containerClassName="table-scroll-shell"
              tableClassName="table-scroll-content min-w-[1180px]"
              actions={(item) => {
                const servicio = item;
                return (
                  <ServiciosCategoriaTableDetalleActions
                    onDelete={handleDelete}
                    onView={onView}
                    pathname={pathname}
                    servicio={servicio}
                  />
                );
              }}
            />

            {showPagination && (
              <PaginationFooter
                page={page}
                totalPages={totalPages}
                hasPrevious={hasPrevious}
                hasMore={hasMore}
                onPrevious={onPrevious}
                onNext={onNext}
                pageSize={pageSize}
                onPageSizeChange={onPageSizeChange}
              />
            )}
          </div>
        </Card>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
          title="Eliminar Servicio"
          description={`Estas seguro de que quieres eliminar el servicio "${servicioToDelete?.nombre}"? Esta accion no se puede deshacer.`}
          confirmText="Eliminar"
          variant="danger"
        >
          <div className="flex items-start space-x-2">
            <Checkbox
              id="delete-payments"
              checked={deletePayments}
              onCheckedChange={(checked) =>
                setDeletePayments(checked as boolean)
              }
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="delete-payments"
                className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Eliminar tambien los registros de pago
              </Label>
              <p className="text-sm text-muted-foreground">
                Al marcar esta opcion, se eliminaran todos los registros de pago
                de la base de datos. Si no se marca, se conservaran para
                historial.
              </p>
            </div>
          </div>
        </ConfirmDialog>
      </>
    );
  },
);
