"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import { useCategoriasCounts } from "@/hooks/use-categorias-counts";
import { FolderOpen, Users, Store } from "lucide-react";

export const CategoriasMetrics = memo(function CategoriasMetrics() {
  const { data: counts } = useCategoriasCounts();
  const totalCategorias = counts?.totalCategorias ?? 0;
  const categoriasClientes = counts?.categoriasClientes ?? 0;
  const categoriasRevendedores = counts?.categoriasRevendedores ?? 0;

  return (
    <MetricGrid>
      <MetricCard
        title="Total Categorías"
        value={totalCategorias}
        icon={FolderOpen}
        tone="info"
      />
      <MetricCard
        title="Categorías de Clientes"
        value={categoriasClientes}
        icon={Users}
        tone="success"
      />
      <MetricCard
        title="Categorías de Revendedores"
        value={categoriasRevendedores}
        icon={Store}
        tone="warning"
      />
    </MetricGrid>
  );
});
