"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { useCategoriasCounts } from "@/hooks/use-categorias-counts";
import { FolderOpen, Users, Store } from "lucide-react";

export const CategoriasMetrics = memo(function CategoriasMetrics() {
  const { data: counts } = useCategoriasCounts();
  const totalCategorias = counts?.totalCategorias ?? 0;
  const categoriasClientes = counts?.categoriasClientes ?? 0;
  const categoriasRevendedores = counts?.categoriasRevendedores ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <MetricCard
        title="Total Categorías"
        value={totalCategorias}
        icon={FolderOpen}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
      <MetricCard
        title="Categorías de Clientes"
        value={categoriasClientes}
        icon={Users}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
      <MetricCard
        title="Categorías de Revendedores"
        value={categoriasRevendedores}
        icon={Store}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
    </div>
  );
});
