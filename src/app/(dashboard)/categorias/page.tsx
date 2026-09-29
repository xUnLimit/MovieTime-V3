'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { CategoriasMetrics } from '@/components/categorias/CategoriasMetrics';
import { ClientesCategoriasTable } from '@/components/categorias/ClientesCategoriasTable';
import { RevendedoresCategoriasTable } from '@/components/categorias/RevendedoresCategoriasTable';
import { TodasCategoriasTable } from '@/components/categorias/TodasCategoriasTable';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { subscribeToCategoriaListReactions } from '@/platform/events/cache-reactions';
import { queryKeys } from '@/platform/query-keys';

function CategoriasPageContent() {
  const queryClient = useQueryClient();
  const { data: categorias = [], refetch: refetchCategorias } = useCategoriasFull();
  const [activeTab, setActiveTab] = useState('todos');

  useEffect(() => {
    return subscribeToCategoriaListReactions(queryClient, refetchCategorias);
  }, [queryClient, refetchCategorias]);

  const handleCategoriaDeleted = async () => {
    await refetchCategorias();
    await queryClient.invalidateQueries({ queryKey: queryKeys.categorias.counts() });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias"
        actions={
          <Button asChild className="whitespace-nowrap">
            <Link prefetch={false} href="/categorias/crear">
              <Plus />
              Nueva Categoria
            </Link>
          </Button>
        }
      />

      <CategoriasMetrics />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger
            value="todos"
          >
            Todos
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
          >
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="revendedores"
          >
            Revendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          <TodasCategoriasTable
            categorias={categorias}
            title="Todas las categorias"
            onCategoriaDeleted={handleCategoriaDeleted}
          />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <ClientesCategoriasTable
            categorias={categorias}
            title="Categorias de Clientes"
            onCategoriaDeleted={handleCategoriaDeleted}
          />
        </TabsContent>

        <TabsContent value="revendedores" className="space-y-4">
          <RevendedoresCategoriasTable
            categorias={categorias}
            title="Categorias de Revendedores"
            onCategoriaDeleted={handleCategoriaDeleted}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CategoriasPage() {
  return (
    <ModuleErrorBoundary moduleName="Categorias">
      <CategoriasPageContent />
    </ModuleErrorBoundary>
  );
}
