"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Edit, Eye, MoreHorizontal, Repeat, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/query-keys";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Servicio } from "@/types";

import {
  serviciosCategoriaColumnsForDataTable,
  toServicioCategoriaRow,
  toServicioCategoriaTableRecord,
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

const cicloOptions = [
  { value: "todos", label: "Todos los ciclos" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const perfilOptions = [
  { value: "todos", label: "Todos los perfiles" },
  { value: "con_disponibles", label: "Con perfiles disponibles" },
  { value: "sin_disponibles", label: "Sin perfiles disponibles" },
];

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
    const { deleteServicio } = useServiciosStore();
    const pathname = usePathname();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [servicioToDelete, setServicioToDelete] = useState<Servicio | null>(
      null,
    );
    const [deletePayments, setDeletePayments] = useState(false);

    const cicloLabel =
      cicloOptions.find((option) => option.value === cicloFilter)?.label ??
      "Todos los ciclos";
    const perfilLabel =
      perfilOptions.find((option) => option.value === perfilFilter)?.label ??
      "Todos los perfiles";

    const serviciosOrdenables = useMemo(
      () =>
        servicios
          .map(toServicioCategoriaRow)
          .map(toServicioCategoriaTableRecord),
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

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
        ]);

        setDeleteDialogOpen(false);
        setServicioToDelete(null);
      } catch (error) {
        toast.error("Error al eliminar servicio", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    };

    return (
      <>
        <Card className="min-w-0 p-3 pb-2 sm:p-4 sm:pb-2">
          <h3 className="text-lg font-semibold sm:text-xl">{title}</h3>
          <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px] sm:items-center sm:gap-4">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between gap-2 font-normal"
                >
                  <FilterTriggerContent icon={Repeat} label={cicloLabel} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
                {cicloOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => onCicloChange(option.value)}
                    className="dashboard-toolbar-menu-item"
                  >
                    <span className="dashboard-toolbar-menu-item-label">
                      {option.label}
                    </span>
                    {cicloFilter === option.value && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between gap-2 font-normal"
                >
                  <FilterTriggerContent icon={UserRound} label={perfilLabel} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
                {perfilOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => onPerfilChange(option.value)}
                    className="dashboard-toolbar-menu-item"
                  >
                    <span className="dashboard-toolbar-menu-item-label">
                      {option.label}
                    </span>
                    {perfilFilter === option.value && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
                const servicio = item as unknown as Servicio;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onView && (
                        <DropdownMenuItem asChild>
                          <Link
                            prefetch={false}
                            href={`/servicios/detalle/${servicio.id}?from=${encodeURIComponent(pathname)}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link
                          prefetch={false}
                          href={`/servicios/${servicio.id}/editar?from=${encodeURIComponent(pathname)}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(servicio)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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