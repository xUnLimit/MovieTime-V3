"use client";

import { memo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ServiciosCategoriaFiltersProps {
  estadoFilter: string;
  onEstadoChange: (value: string) => void;
}

export const ServiciosCategoriaFilters = memo(
  function ServiciosCategoriaFilters({
    estadoFilter,
    onEstadoChange,
  }: ServiciosCategoriaFiltersProps) {
    return (
      <Tabs value={estadoFilter} onValueChange={onEstadoChange}>
        <TabsList>
          <TabsTrigger
            value="activo"
          >
            Activo
          </TabsTrigger>
          <TabsTrigger
            value="inactivo"
          >
            Inactivo
          </TabsTrigger>
          <TabsTrigger
            value="todos"
          >
            Todos
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );
  },
);
