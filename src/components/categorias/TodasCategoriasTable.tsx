"use client";

import type { Categoria } from "@/types";

import { CategoriasListTable } from "./CategoriasListTable";

interface TodasCategoriasTableProps {
  categorias: Categoria[];
  title?: string;
  onCategoriaDeleted?: () => void | Promise<void>;
}

export function TodasCategoriasTable({
  categorias,
  title = "Todas las categorías",
  onCategoriaDeleted,
}: TodasCategoriasTableProps) {
  return (
    <CategoriasListTable
      categorias={categorias}
      title={title}
      searchPlaceholder="Buscar por nombre o tipo..."
      onCategoriaDeleted={onCategoriaDeleted}
    />
  );
}
