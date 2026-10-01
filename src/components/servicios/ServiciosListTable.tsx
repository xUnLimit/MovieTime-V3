"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { ServerTableCard } from "@/components/shared/ServerTableCard";
import { ServiciosListTableActions } from "./ServiciosListTableActions";
import { ServiciosListTableToolbar } from "./ServiciosListTableToolbar";
import { createServiciosListColumns } from "./servicios-list-table-columns";
import { toServicioRows } from "./servicios-list-table-helpers";
import type { ServiciosListTableProps } from "./servicios-list-table-types";

export function ServiciosListTable({
  servicios,
  isLoading,
  title,
  searchQuery,
  onSearchChange,
  categorias = [],
  selectedCategoriaId = "todas",
  onCategoriaChange,
  orderBy = "createdAt",
  onOrderByChange,
  hasMore,
  hasPrevious,
  page,
  totalPages,
  onNext,
  onPrevious,
  pageSize,
  onPageSizeChange,
}: ServiciosListTableProps) {
  const rows = useMemo(() => toServicioRows(servicios), [servicios]);
  const columns = useMemo(() => createServiciosListColumns(), []);

  return (
    <ServerTableCard
      title={title}
      rowCount={rows.length}
      loading={isLoading}
      pagination={{ page, totalPages, hasPrevious, hasMore, onPrevious, onNext, pageSize, onPageSizeChange }}
      toolbar={
        <ServiciosListTableToolbar
          categorias={categorias}
          onCategoriaChange={onCategoriaChange}
          onOrderByChange={onOrderByChange}
          onSearchChange={onSearchChange}
          orderBy={orderBy}
          searchQuery={searchQuery}
          selectedCategoriaId={selectedCategoriaId}
        />
      }
    >
      <DataTable
        bare
        fixedLayout
        data={rows}
        columns={columns}
        loading={isLoading}
        emptyMessage="No hay servicios para mostrar"
        pagination={false}
        actions={(item) => <ServiciosListTableActions item={item} />}
      />
    </ServerTableCard>
  );
}
