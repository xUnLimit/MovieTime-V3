"use client";

import type { Categoria } from "@/types";

import { CategoriasListTable } from "./CategoriasListTable";

interface RevendedoresCategoriasTableProps {
  categorias: Categoria[];
  title?: string;
  onCategoriaDeleted?: () => void | Promise<void>;
}

export function RevendedoresCategoriasTable({
  categorias,
  title = "Categorías de Revendedores",
  onCategoriaDeleted,
}: RevendedoresCategoriasTableProps) {
  return (
    <CategoriasListTable
      categorias={categorias}
      title={title}
      tipo="revendedor"
      searchPlaceholder="Buscar por nombre..."
      onCategoriaDeleted={onCategoriaDeleted}
    />
  );
}
