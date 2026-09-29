"use client";

import type { Categoria } from "@/types";

import { CategoriasListTable } from "./CategoriasListTable";

interface ClientesCategoriasTableProps {
  categorias: Categoria[];
  title?: string;
  onCategoriaDeleted?: () => void | Promise<void>;
}

export function ClientesCategoriasTable({
  categorias,
  title = "Categorías de Clientes",
  onCategoriaDeleted,
}: ClientesCategoriasTableProps) {
  return (
    <CategoriasListTable
      categorias={categorias}
      title={title}
      tipo="cliente"
      searchPlaceholder="Buscar por nombre..."
      onCategoriaDeleted={onCategoriaDeleted}
    />
  );
}
