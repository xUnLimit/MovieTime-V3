"use client";

import { useMemo, useState } from "react";

import { useVentasPorCategorias } from "@/hooks/use-ventas-por-categorias";
import type { Categoria } from "@/types";

export interface CategoriaRow {
  id: string;
  nombre: string;
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
  const categoriaIds = useMemo(
    () => categorias.filter((c) => c.activo).map((c) => c.id),
    [categorias],
  );
  const { stats: ventasPorCategoria, isLoading: isLoadingVentas } =
    useVentasPorCategorias(categoriaIds);

  const rows = useMemo<CategoriaRow[]>(
    () =>
      categorias
        .filter((cat) => cat.activo)
        .map((categoria) => {
          const gastosTotal = categoria.gastosTotal ?? 0;
          const ingresoTotal = categoria.ingresosTotales ?? 0;

          return {
            id: categoria.id,
            nombre: categoria.nombre,
            categoria,
            totalServicios: categoria.totalServicios ?? 0,
            serviciosActivos: categoria.serviciosActivos ?? 0,
            perfilesDisponibles: categoria.perfilesDisponiblesTotal ?? 0,
            ventasTotales: categoria.ventasTotales ?? 0,
            ingresoTotal,
            gastosTotal,
            gananciaTotal: ingresoTotal - gastosTotal,
            montoSinConsumir: ventasPorCategoria[categoria.id]?.montoSinConsumir ?? 0,
          };
        }),
    [categorias, ventasPorCategoria],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return rows
      .filter((row) => {
        if (!row.nombre.toLowerCase().includes(query)) return false;
        if (perfilDisponibilidadFilter === "con_disponibles") return row.perfilesDisponibles > 0;
        if (perfilDisponibilidadFilter === "sin_disponibles") return row.perfilesDisponibles === 0;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [perfilDisponibilidadFilter, rows, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    perfilDisponibilidadFilter,
    setPerfilDisponibilidadFilter,
    isLoadingVentas,
    rows: filteredRows,
  };
}
