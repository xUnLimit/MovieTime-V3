"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import { Card } from "@/components/ui/card";
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
    <Card className="min-w-0 p-4 pb-2">
      {title && <h3 className="text-xl font-semibold">{title}</h3>}
      <ServiciosListTableToolbar
        categorias={categorias}
        onCategoriaChange={onCategoriaChange}
        onOrderByChange={onOrderByChange}
        onSearchChange={onSearchChange}
        orderBy={orderBy}
        searchQuery={searchQuery}
        selectedCategoriaId={selectedCategoriaId}
      />

      {isLoading ? (
        <ServiciosListEmptyState message="Cargando servicios..." />
      ) : rows.length === 0 ? (
        <ServiciosListEmptyState message="No hay servicios para mostrar" />
      ) : (
        <div>
          <DataTable
            data={rows}
            columns={columns}
            pagination={false}
            fixedLayout
            tableClassName="min-w-[1100px]"
            actions={(item) => <ServiciosListTableActions item={item} />}
          />

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
        </div>
      )}
    </Card>
  );
}

function ServiciosListEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
