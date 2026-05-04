"use client";

import { useState, useMemo } from "react";
import { Categoria } from "@/types";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCategoriasStore } from "@/store/categoriasStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import Link from "next/link";

const tipoLabels: Record<string, string> = {
  cliente: "Cliente",
  revendedor: "Revendedor",
  ambos: "Cliente",
};

const tipoCategoriaLabels: Record<string, string> = {
  plataforma_streaming: "Plataforma de Streaming",
  otros: "Otros",
};

interface TodasCategoriasTableProps {
  categorias: Categoria[];
  title?: string;
}

export function TodasCategoriasTable({
  categorias,
  title = "Todas las categorías",
}: TodasCategoriasTableProps) {
    const { deleteCategoria } = useCategoriasStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");

  // Filtrar y ordenar categorías
  const filteredCategorias = useMemo(() => {
    const filtered = categorias.filter((categoria) => {
      const matchesSearch = categoria.nombre
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesTipo =
        tipoFilter === "todos" ||
        categoria.tipo === tipoFilter ||
        categoria.tipo === "ambos";
      return matchesSearch && matchesTipo;
    });
    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [categorias, searchQuery, tipoFilter]);

  const handleDelete = (categoria: Categoria) => {
    setCategoriaToDelete(categoria);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (categoriaToDelete) {
      try {
        await deleteCategoria(categoriaToDelete.id);
        toast.success("Categoría eliminada", {
          description: "La categoría ha sido eliminada correctamente.",
        });
      } catch (error) {
        toast.error("Error al eliminar categoría", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const columns: Column<Categoria>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Nombre",
        sortable: true,
        width: "15%",
        render: (item) => <span className="font-medium">{item.nombre}</span>,
      },
      {
        key: "tipo",
        header: "Asociado a",
        sortable: true,
        align: "center",
        width: "25%",
        render: (item) => {
          // Para "ambos", mostrar ambos tipos
          if (item.tipo === "ambos") {
            return <span>Cliente, Revendedor</span>;
          }
          return <span>{tipoLabels[item.tipo]}</span>;
        },
      },
      {
        key: "categoria",
        header: "Tipo de Categoría",
        sortable: false,
        align: "center",
        width: "25%",
        render: (item) => (
          <span>
            {tipoCategoriaLabels[item.tipoCategoria ?? ""] ?? "No definido"}
          </span>
        ),
      },
      {
        key: "estado",
        header: "Estado",
        sortable: true,
        align: "center",
        width: "30%",
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
    [],
  );

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="flex items-center gap-4 -mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {(() => {
            const opciones = [
              { value: "todos", label: "Todos los tipos" },
              { value: "cliente", label: "Cliente" },
              { value: "revendedor", label: "Revendedor" },
              { value: "ambos", label: "Ambos" },
            ];
            const labelActual =
              opciones.find((o) => o.value === tipoFilter)?.label ??
              "Todos los tipos";
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-between font-normal"
                  >
                    {labelActual}
                    <svg
                      className="h-4 w-4 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {opciones.map((op) => (
                    <DropdownMenuItem
                      key={op.value}
                      onClick={() => setTipoFilter(op.value)}
                      className="flex items-center justify-between"
                    >
                      {op.label}
                      {tipoFilter === op.value && (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>

        <DataTable
          data={filteredCategorias as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          pagination={true}
          itemsPerPageOptions={[10, 25, 50, 100]}
          actions={(item) => {
            const categoria = item as unknown as Categoria;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/categorias/${categoria.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/categorias/${categoria.id}/editar`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(categoria)}
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
      </Card>

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
