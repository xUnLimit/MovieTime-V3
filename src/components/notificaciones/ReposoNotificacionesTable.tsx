"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { PaginationFooter } from "@/components/shared/PaginationFooter";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useNotificaciones } from "@/hooks/use-notificaciones";
import { queryKeys } from "@/lib/query-keys";
import { useNotificacionesStore } from "@/store/notificacionesStore";
import { ReposoNotificacionesRows } from "./ReposoNotificacionesRows";
import { ReposoNotificacionesToolbar } from "./ReposoNotificacionesToolbar";
import { filterReposoRows } from "./reposo-notificaciones-table-helpers";
import {
  ESTADO_REPOSO_OPTIONS,
  type ReposoRow,
} from "./reposo-notificaciones-table-types";

export function ReposoNotificacionesTable() {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const toggleLeida = useNotificacionesStore((state) => state.toggleLeida);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const estadoFilterLabel =
    ESTADO_REPOSO_OPTIONS.find((option) => option.value === estadoFilter)?.label ?? "Todos los estados";

  const reposoNotificaciones = useMemo(() => {
    return notificaciones
      .filter((n): n is ReposoRow => n.entidad === "reposo")
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [notificaciones]);

  const filtered = useMemo(
    () => filterReposoRows({ estadoFilter, reposoNotificaciones, search }),
    [estadoFilter, reposoNotificaciones, search],
  );

  const {
    data: paginated,
    page,
    totalPages,
    hasPrevious,
    hasMore,
    pageSize,
    setPageSize,
    next,
    previous,
    reset: resetPagination,
  } = useClientPagination({
    data: filtered,
    initialPageSize: 10,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    resetPagination();
  };

  const handleEstadoFilterChange = (value: string) => {
    setEstadoFilter(value);
    resetPagination();
  };

  const handleToggleLeida = async (notifId: string, leida: boolean) => {
    await toggleLeida(notifId, leida);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  };

  return (
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">Servicios en Reposo</h3>
      <ReposoNotificacionesToolbar
        estadoFilter={estadoFilter}
        estadoFilterLabel={estadoFilterLabel}
        onEstadoFilterChange={handleEstadoFilterChange}
        onSearchChange={handleSearchChange}
        search={search}
      />

      <div>
        <div className="notification-table-scroll-shell rounded-md border">
          <Table className="table-scroll-content min-w-[980px] lg:min-w-full">
            <TableHeader>
              <TableRow className="border-b hover:bg-muted/50">
                <ReposoTableHead className="w-[56px]">Tipo</ReposoTableHead>
                <ReposoTableHead className="min-w-[130px]">Categoría</ReposoTableHead>
                <ReposoTableHead className="min-w-[200px]">Correo</ReposoTableHead>
                <ReposoTableHead className="min-w-[125px]">Fecha Inicio</ReposoTableHead>
                <ReposoTableHead className="min-w-[125px]">Fecha Fin</ReposoTableHead>
                <ReposoTableHead className="min-w-[150px]">Fecha Fin Reposo</ReposoTableHead>
                <ReposoTableHead className="min-w-[125px]">Estado</ReposoTableHead>
                <ReposoTableHead className="min-w-[74px]">Acciones</ReposoTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <ReposoNotificacionesRows
                filteredCount={filtered.length}
                notificaciones={paginated}
                onToggleLeida={(notifId, leida) => void handleToggleLeida(notifId, leida)}
              />
            </TableBody>
          </Table>
        </div>

        <PaginationFooter
          page={page}
          totalPages={totalPages}
          hasPrevious={hasPrevious}
          hasMore={hasMore}
          onPrevious={previous}
          onNext={next}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          className="px-2 py-2"
        />
      </div>
    </Card>
  );
}

function ReposoTableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <TableHead className={`h-10 px-2 text-center text-muted-foreground ${className}`}>
      {children}
    </TableHead>
  );
}
