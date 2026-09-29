"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { hideBelowClass } from "@/components/shared/DataTable";
import { ServerTableCard } from "@/components/shared/ServerTableCard";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useNotificaciones } from "@/hooks/use-notificaciones";
import { toggleNotificationReadStoreCache } from "@/application/store-reactions/notification-cache-reactions";
import { applyNotificationQueryReactions } from "@/application/store-reactions/notification-query-reactions";
import { ReposoNotificacionesRows } from "./ReposoNotificacionesRows";
import { ReposoNotificacionesToolbar } from "./ReposoNotificacionesToolbar";
import { filterReposoRows } from "./reposo-notificaciones-table-helpers";
import type { ReposoRow } from "./reposo-notificaciones-table-types";

export function ReposoNotificacionesTable() {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

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
    await toggleNotificationReadStoreCache(notifId, leida);
    await applyNotificationQueryReactions(queryClient, {
      notificationInvalidationNeeded: true,
    });
  };

  return (
    <ServerTableCard
      title="Servicios en Reposo"
      rowCount={paginated.length}
      rowHeight={48}
      pagination={{
        page,
        totalPages,
        hasPrevious,
        hasMore,
        onPrevious: previous,
        onNext: next,
        pageSize,
        onPageSizeChange: setPageSize,
      }}
      toolbar={
        <ReposoNotificacionesToolbar
          estadoFilter={estadoFilter}
          onEstadoFilterChange={handleEstadoFilterChange}
          onSearchChange={handleSearchChange}
          search={search}
        />
      }
    >
      <Table>
        <TableHeader>
          <TableRow className="border-b hover:bg-muted/50">
            <ReposoTableHead className="w-14">Tipo</ReposoTableHead>
            <ReposoTableHead className="">Categoría</ReposoTableHead>
            <ReposoTableHead className={`min-w-48 ${hideBelowClass("lg")}`}>Correo</ReposoTableHead>
            <ReposoTableHead className={`min-w-32 ${hideBelowClass("xl")}`}>Fecha Inicio</ReposoTableHead>
            <ReposoTableHead className={`min-w-32 ${hideBelowClass("xl")}`}>Fecha Fin</ReposoTableHead>
            <ReposoTableHead className={`min-w-36 ${hideBelowClass("md")}`}>Fecha Fin Reposo</ReposoTableHead>
            <ReposoTableHead className="">Estado</ReposoTableHead>
            <ReposoTableHead className="">Acciones</ReposoTableHead>
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
    </ServerTableCard>
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
