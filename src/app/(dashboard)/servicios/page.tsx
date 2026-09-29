'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateInitialPageSize } from '@/hooks/useFitPageSize';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoriasTable } from '@/components/servicios/CategoriasTable';
import { ServiciosMetrics } from '@/components/servicios/ServiciosMetrics';
import { ServiciosListTable } from '@/components/servicios/ServiciosListTable';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useServerPagination } from '@/hooks/useServerPagination';
import { subscribeToServicioListReactions } from '@/platform/events/cache-reactions';
import { SERVICIOS_COLLECTION } from '@/application/use-cases/servicios/servicios-query-use-cases';
import type { FilterOption } from '@/types/pagination';
import { Servicio } from '@/types';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

function ServiciosPageContent() {
  const queryClient = useQueryClient();
  const { data: categorias = [] } = useCategoriasFull();
  const showServiciosMetrics = useFeatureFlag('servicios_metrics', true);

  const [activeTab, setActiveTab] = useState<'categorias' | 'todos' | 'activos' | 'inactivos'>('categorias');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('todas');
  const [orderBy, setOrderBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [pageSize, setPageSize] = useState(() => estimateInitialPageSize(54));

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

  useEffect(() => {
    return subscribeToServicioListReactions(queryClient, refresh);
  }, [queryClient, refresh]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'categorias' | 'todos' | 'activos' | 'inactivos');
    setSearchQuery('');
    setSelectedCategoriaId('todas');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Servicios"
        actions={
          <Button asChild className="whitespace-nowrap">
            <Link prefetch={false} href="/servicios/crear">
              <Plus />
              Nuevo Servicio
            </Link>
          </Button>
        }
      />

      {showServiciosMetrics && <ServiciosMetrics />}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto flex-wrap">
            {(['categorias', 'todos', 'activos', 'inactivos'] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
              >
                {tab === 'categorias' ? 'Categorías' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

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
              onPageSizeChange={setPageSize}
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
