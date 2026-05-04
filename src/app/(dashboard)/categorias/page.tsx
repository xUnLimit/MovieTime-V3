'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TodasCategoriasTable } from '@/components/categorias/TodasCategoriasTable';
import { ClientesCategoriasTable } from '@/components/categorias/ClientesCategoriasTable';
import { RevendedoresCategoriasTable } from '@/components/categorias/RevendedoresCategoriasTable';
import { CategoriasMetrics } from '@/components/categorias/CategoriasMetrics';
import { useCategoriasStore } from '@/store/categoriasStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

function CategoriasPageContent() {
  const { categorias, fetchCategorias, fetchCounts } = useCategoriasStore();
  const [activeTab, setActiveTab] = useState('todos');

  useEffect(() => {
    fetchCategorias();
    fetchCounts();
  }, [fetchCategorias, fetchCounts]);

  // Escuchar cuando se elimina una categoría desde otra página
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'categoria-deleted') {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Categorías</span>
          </p>
        </div>
        <Link href="/categorias/crear" className="self-start sm:self-auto">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        </Link>
      </div>

      <CategoriasMetrics />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="todos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Todos
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="revendedores"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Revendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          <TodasCategoriasTable
            categorias={categorias}
            title="Todas las categorías"
          />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <ClientesCategoriasTable
            categorias={categorias}
            title="Categorías de Clientes"
          />
        </TabsContent>

        <TabsContent value="revendedores" className="space-y-4">
          <RevendedoresCategoriasTable
            categorias={categorias}
            title="Categorías de Revendedores"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CategoriasPage() {
  return (
    <ModuleErrorBoundary moduleName="Categorías">
      <CategoriasPageContent />
    </ModuleErrorBoundary>
  );
}
