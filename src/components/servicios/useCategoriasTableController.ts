"use client";

import { useMemo, useState } from "react";

import { useVentasPorCategorias } from "@/hooks/use-ventas-por-categorias";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Categoria } from "@/types";

export interface CategoriaRow {
  categoria: Categoria;
  totalServicios: number;
  serviciosActivos: number;
  perfilesDisponibles: number;
  ventasTotales: number;
  ingresoTotal: number;
  gastosTotal: number;
  gananciaTotal: number;
  montoSinConsumir: number;
}

export type PerfilDisponibilidadFilter =
  | "todos"
  | "con_disponibles"
  | "sin_disponibles";

export const perfilDisponibilidadOptions: {
  value: PerfilDisponibilidadFilter;
  label: string;
}[] = [
  { value: "todos", label: "Todos los perfiles" },
  { value: "con_disponibles", label: "Con perfiles disponibles" },
  { value: "sin_disponibles", label: "Sin perfiles disponibles" },
];

export function useCategoriasTableController(categorias: Categoria[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [perfilDisponibilidadFilter, setPerfilDisponibilidadFilter] =
    useState<PerfilDisponibilidadFilter>("todos");
  const [sortKey, setSortKey] = useState<keyof CategoriaRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    null,
  );
  const { servicios } = useServiciosStore();

  const categoriaIds = useMemo(
    () => categorias.filter((c) => c.activo).map((c) => c.id),
    [categorias],
  );
  const { stats: ventasPorCategoria, isLoading: isLoadingVentas } =
    useVentasPorCategorias(categoriaIds);

  const countersByCategoria = useMemo(() => {
    const counters = new Map<
      string,
      {
        totalServicios: number;
        serviciosActivos: number;
        perfilesDisponibles: number;
      }
    >();

    for (const servicio of servicios) {
      if (servicio.enReposo) continue;

      const current = counters.get(servicio.categoriaId) ?? {
        totalServicios: 0,
        serviciosActivos: 0,
        perfilesDisponibles: 0,
      };

      current.totalServicios += 1;
      if (servicio.activo) {
        current.serviciosActivos += 1;
        const libres = Math.max(
          (servicio.perfilesDisponibles || 0) -
            (servicio.perfilesOcupados || 0),
          0,
        );
        current.perfilesDisponibles += libres;
      }

      counters.set(servicio.categoriaId, current);
    }

    return counters;
  }, [servicios]);

  const rows = useMemo(() => {
    const categoriaData: CategoriaRow[] = categorias
      .filter((cat) => cat.activo)
      .map((categoria) => {
        const counters = countersByCategoria.get(categoria.id);
        const totalServicios = counters?.totalServicios ?? 0;
        const serviciosActivos = counters?.serviciosActivos ?? 0;
        const perfilesDisponibles = counters?.perfilesDisponibles ?? 0;

        const gastosTotal = categoria.gastosTotal ?? 0;
        const ingresoTotal = categoria.ingresosTotales ?? 0;
        const ventasTotales = categoria.ventasTotales ?? 0;
        const gananciaTotal = ingresoTotal - gastosTotal;
        const montoSinConsumir =
          ventasPorCategoria[categoria.id]?.montoSinConsumir ?? 0;

        return {
          categoria,
          totalServicios,
          serviciosActivos,
          perfilesDisponibles,
          ventasTotales,
          ingresoTotal,
          gastosTotal,
          gananciaTotal,
          montoSinConsumir,
        };
      });

    return categoriaData;
  }, [categorias, countersByCategoria, ventasPorCategoria]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = row.categoria.nombre
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (perfilDisponibilidadFilter === "con_disponibles") {
        return row.perfilesDisponibles > 0;
      }
      if (perfilDisponibilidadFilter === "sin_disponibles") {
        return row.perfilesDisponibles === 0;
      }
      return true;
    });
  }, [perfilDisponibilidadFilter, rows, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return [...filteredRows].sort((a, b) =>
        a.categoria.nombre.localeCompare(b.categoria.nombre, "es"),
      );
    }

    const getSortValue = (
      row: CategoriaRow,
      key: keyof CategoriaRow,
    ): string | number => {
      if (key === "categoria") return row.categoria.nombre;
      return row[key];
    };

    return [...filteredRows].sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      if (aValue === bValue) return 0;
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortKey, sortDirection]);

  const pagination = useClientPagination({
    data: sortedRows,
    initialPageSize: 10,
  });

  const handleSort = (key: keyof CategoriaRow) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    pagination.reset();
  };

  const perfilDisponibilidadLabel =
    perfilDisponibilidadOptions.find(
      (option) => option.value === perfilDisponibilidadFilter,
    )?.label ?? "Todos los perfiles";

  return {
    searchTerm,
    setSearchTerm,
    perfilDisponibilidadFilter,
    setPerfilDisponibilidadFilter,
    perfilDisponibilidadLabel,
    sortKey,
    sortDirection,
    isLoadingVentas,
    paginatedRows: pagination.data,
    page: pagination.page,
    totalPages: pagination.totalPages,
    hasPrevious: pagination.hasPrevious,
    hasMore: pagination.hasMore,
    pageSize: pagination.pageSize,
    setPageSize: pagination.setPageSize,
    next: pagination.next,
    previous: pagination.previous,
    resetPagination: pagination.reset,
    handleSort,
  };
}
