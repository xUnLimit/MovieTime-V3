import { useMemo, useState } from "react";

import {
  getPaginasNotificacionesVenta,
  getVentasNotificacionesFiltradas,
} from "./filters";
import type { NotificacionConId } from "./types";

export function useVentasProximasPagination(notificaciones: NotificacionConId[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const ventasNotificaciones = useMemo(
    () =>
      getVentasNotificacionesFiltradas(
        notificaciones,
        searchQuery,
        estadoFilter,
      ),
    [notificaciones, searchQuery, estadoFilter],
  );

  const notificationPages = useMemo(
    () => getPaginasNotificacionesVenta(ventasNotificaciones, itemsPerPage),
    [ventasNotificaciones, itemsPerPage],
  );
  const totalPages = Math.max(1, notificationPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotificaciones =
    notificationPages[safeCurrentPage - 1] ?? [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEstadoFilterChange = (value: string) => {
    setEstadoFilter(value);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return {
    estadoFilter,
    handleEstadoFilterChange,
    handleItemsPerPageChange,
    handleNextPage,
    handlePreviousPage,
    handleSearchChange,
    itemsPerPage,
    paginatedNotificaciones,
    safeCurrentPage,
    searchQuery,
    totalPages,
    ventasNotificaciones,
  };
}
