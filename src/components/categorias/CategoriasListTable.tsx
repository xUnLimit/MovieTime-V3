"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit, Eye, ListFilter, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCategoriaMutation } from "@/application/client-domain-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import type { Categoria } from "@/types";

const tipoLabels: Record<string, string> = {
  cliente: "Cliente",
  revendedor: "Revendedor",
};

const tipoCategoriaLabels: Record<string, string> = {
  plataforma_streaming: "Plataforma de Streaming",
  otros: "Otros",
};

const TIPO_CATEGORIA_OPTIONS = [
  { value: "todos", label: "Todos los tipos" },
  { value: "plataforma_streaming", label: "Plataforma de Streaming" },
  { value: "otros", label: "Otros" },
] as const;

export interface CategoriasListTableProps {
  categorias: Categoria[];
  title: string;
  /** Limita la lista a un tipo de tercero; sin valor muestra todas y agrega la columna "Asociado a". */
  tipo?: Categoria["tipo"];
  searchPlaceholder: string;
  onCategoriaDeleted?: () => void | Promise<void>;
}

const baseColumns = defineDataTableColumns<Categoria>([
  {
    key: "nombre",
    header: "Nombre",
    sortable: true,
    render: (item) => <span className="font-medium">{item.nombre}</span>,
  },
  {
    key: "categoria",
    header: "Tipo de Categoría",
    align: "center",
    hideBelow: "sm",
    render: (item) => (
      <span>{tipoCategoriaLabels[item.tipoCategoria ?? ""] ?? "No definido"}</span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    sortable: true,
    align: "center",
    render: (item) => (
      <StatusBadge tone={item.activo ? "success" : "danger"}>
        {item.activo ? "Activo" : "Inactivo"}
      </StatusBadge>
    ),
  },
]);

const asociadoColumn = defineDataTableColumns<Categoria>([
  {
    key: "tipo",
    header: "Asociado a",
    sortable: true,
    align: "center",
    hideBelow: "md",
    render: (item) => <span>{tipoLabels[item.tipo]}</span>,
  },
])[0];

export function CategoriasListTable({
  categorias,
  title,
  tipo,
  searchPlaceholder,
  onCategoriaDeleted,
}: CategoriasListTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoCategoriaFilter, setTipoCategoriaFilter] = useState<
    (typeof TIPO_CATEGORIA_OPTIONS)[number]["value"]
  >("todos");

  const filteredCategorias = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return categorias
      .filter((categoria) => {
        if (tipo && categoria.tipo !== tipo) return false;
        const matchesTipoCategoria =
          tipoCategoriaFilter === "todos" || categoria.tipoCategoria === tipoCategoriaFilter;
        return matchesTipoCategoria && categoria.nombre.toLowerCase().includes(query);
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [categorias, tipo, searchQuery, tipoCategoriaFilter]);

  const columns = useMemo(
    () => (tipo ? baseColumns : [baseColumns[0], asociadoColumn, ...baseColumns.slice(1)]),
    [tipo],
  );

  const handleDelete = (categoria: Categoria) => {
    setCategoriaToDelete(categoria);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoriaToDelete) return;
    try {
      await deleteCategoriaMutation(categoriaToDelete.id, categoriaToDelete);
      await onCategoriaDeleted?.();
      toast.success("Categoría eliminada", {
        description: "La categoría ha sido eliminada correctamente.",
      });
    } catch (error) {
      toast.error("Error al eliminar categoría", {
        description: getPublicErrorMessage(error, "No se pudo eliminar la categoría."),
      });
    }
  };

  return (
    <>
      <TableCard
        title={title}
        toolbar={
          <TableToolbar>
            <TableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
            />
            <FilterMenu
              icon={ListFilter}
              ariaLabel="Tipo de categoría"
              value={tipoCategoriaFilter}
              options={TIPO_CATEGORIA_OPTIONS}
              onChange={setTipoCategoriaFilter}
            />
          </TableToolbar>
        }
      >
        <DataTable
          bare
          autoPageSize
          pagination
          data={filteredCategorias}
          columns={columns}
          actions={(categoria) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones de la categoría">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href={`/categorias/${categoria.id}`}>
                    <Eye />
                    Ver detalles
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href={`/categorias/${categoria.id}/editar`}>
                    <Edit />
                    Editar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => handleDelete(categoria)}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </TableCard>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Categoría"
        description={`¿Estás seguro de que quieres eliminar la categoría "${categoriaToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
