'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { CategoriasMetrics } from '@/components/categorias/CategoriasMetrics';
import { ClientesCategoriasTable } from '@/components/categorias/ClientesCategoriasTable';
import { RevendedoresCategoriasTable } from '@/components/categorias/RevendedoresCategoriasTable';
import { TodasCategoriasTable } from '@/components/categorias/TodasCategoriasTable';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategoriasStore } from '@/store/categoriasStore';

function CategoriasPageContent() {
  const { categorias, fetchCategorias, fetchCounts } = useCategoriasStore();
  const [activeTab, setActiveTab] = useState('todos');

  useEffect(() => {
    fetchCategorias();
    fetchCounts();
  }, [fetchCategorias, fetchCounts]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'categoria-deleted') {
        fetchCategorias(true);
        fetchCounts();
      }
    };

    const handleCategoriaDeleted = () => {
      fetchCategorias(true);
      fetchCounts();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('categoria-deleted', handleCategoriaDeleted);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('categoria-deleted', handleCategoriaDeleted);
    };
  }, [fetchCategorias, fetchCounts]);

  return (
    <div className="space-y-4">
      <div className="dashboard-page-heading">
        <div className="dashboard-page-heading-row">
          <div className="dashboard-page-heading-copy">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Categorias</h1>
          </div>
          <Link href="/categorias/crear" className="shrink-0">
            <Button className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Categoria
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">Dashboard</Link> /{' '}
          <span className="text-foreground">Categorias</span>
        </p>
      </div>

      <CategoriasMetrics />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="todos"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Todos
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="revendedores"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Revendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          <TodasCategoriasTable categorias={categorias} title="Todas las categorias" />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <ClientesCategoriasTable categorias={categorias} title="Categorias de Clientes" />
        </TabsContent>

        <TabsContent value="revendedores" className="space-y-4">
          <RevendedoresCategoriasTable categorias={categorias} title="Categorias de Revendedores" />
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
