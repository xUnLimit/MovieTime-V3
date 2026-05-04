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
        <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="activo"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Activo
          </TabsTrigger>
          <TabsTrigger
            value="inactivo"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Inactivo
          </TabsTrigger>
          <TabsTrigger
            value="todos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Todos
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );
  },
);
