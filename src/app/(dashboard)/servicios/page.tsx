'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoriasTable } from '@/components/servicios/CategoriasTable';
import { ServiciosMetrics } from '@/components/servicios/ServiciosMetrics';
import { ServiciosListTable } from '@/components/servicios/ServiciosListTable';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useServerPagination } from '@/hooks/useServerPagination';
import { SERVICIOS_COLLECTION } from '@/lib/use-cases/servicios-use-cases';
import { FilterOption } from '@/lib/supabase/pagination';
import { Servicio } from '@/types';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

function ServiciosPageContent() {
  const categorias = useCategoriasStore((state) => state.categorias);
  const fetchCategorias = useCategoriasStore((state) => state.fetchCategorias);
  const fetchServicios = useServiciosStore((state) => state.fetchServicios);
  const fetchDashboardStats = useDashboardStore((state) => state.fetchDashboardStats);

  const [activeTab, setActiveTab] = useState<'categorias' | 'todos' | 'activos' | 'inactivos'>('categorias');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('todas');
  const [orderBy, setOrderBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [pageSize, setPageSize] = useState(10);

  const filters = useMemo((): FilterOption[] => {
    const f: FilterOption[] = [];
    if (activeTab === 'activos') {
      f.push({ field: 'activo', operator: '==', value: true });
    } else if (activeTab === 'inactivos') {
      f.push({ field: 'activo', operator: '==', value: false });
    }
    if (selectedCategoriaId !== 'todas') {
      f.push({ field: 'categoriaId', operator: '==', value: selectedCategoriaId });
    }
    if (searchQuery.trim()) {
      f.push({
        field: '__search__',
        operator: 'orIlike',
        value: { fields: ['nombre', 'correo', 'categoriaNombre'], value: searchQuery.trim() },
      });
    }
    return f;
  }, [activeTab, selectedCategoriaId, searchQuery]);

  const {
    data: serviciosData,
    isLoading,
    hasMore,
    hasPrevious,
    page,
    totalPages,
    next,
    previous,
    refresh,
  } = useServerPagination<Servicio>({
    collectionName: SERVICIOS_COLLECTION,
    filters,
    pageSize,
    orderByField: orderBy,
    orderDirection: 'desc',
    includeTotalCount: true,
  });

  // Cargar datos iniciales
  useEffect(() => {
    fetchCategorias(true);
    fetchServicios(true);
    fetchDashboardStats();
  }, [fetchCategorias, fetchServicios, fetchDashboardStats]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'servicio-deleted') {
        fetchCategorias(true);
        fetchServicios(true);
        refresh();
      }
    };
    const handleServicioDeleted = () => {
      fetchCategorias(true);
      fetchServicios(true);
      refresh();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('servicio-deleted', handleServicioDeleted);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('servicio-deleted', handleServicioDeleted);
    };
  }, [fetchCategorias, fetchServicios, refresh]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'categorias' | 'todos' | 'activos' | 'inactivos');
    setSearchQuery('');
    setSelectedCategoriaId('todas');
  };

  return (
    <div className="space-y-4">
      <div className="dashboard-page-heading">
        <div className="dashboard-page-heading-row">
          <div className="dashboard-page-heading-copy space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicios</h1>
            <p className="text-sm text-muted-foreground">
              <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Servicios</span>
            </p>
          </div>
          <Link prefetch={false} href="/servicios/crear" className="shrink-0">
            <Button className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Servicio
            </Button>
          </Link>
        </div>
      </div>

      <ServiciosMetrics />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="tabs-scroll-shell -mx-1 px-1">
          <TabsList className="tabs-scroll-list h-auto rounded-none border-b border-border bg-transparent p-0">
            {(['categorias', 'todos', 'activos', 'inactivos'] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {tab === 'categorias' ? 'Categorías' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="categorias" className="min-w-0 space-y-4">
          <CategoriasTable
            categorias={categorias}
            title="Todas las categorías"
          />
        </TabsContent>

        {activeTab !== 'categorias' && (
          <TabsContent value={activeTab} className="min-w-0 space-y-4">
            <ServiciosListTable
              servicios={serviciosData}
              isLoading={isLoading}
              title={activeTab === 'todos' ? 'Todos los servicios' : activeTab === 'activos' ? 'Servicios activos' : 'Servicios inactivos'}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categorias={categorias}
              selectedCategoriaId={selectedCategoriaId}
              onCategoriaChange={setSelectedCategoriaId}
              orderBy={orderBy}
              onOrderByChange={(v) => { setOrderBy(v); refresh(); }}
              hasMore={hasMore}
              hasPrevious={hasPrevious}
              page={page}
              totalPages={totalPages}
              onNext={next}
              onPrevious={previous}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); refresh(); }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function ServiciosPage() {
  return (
    <ModuleErrorBoundary moduleName="Servicios">
      <ServiciosPageContent />
    </ModuleErrorBoundary>
  );
}
