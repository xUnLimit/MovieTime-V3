'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ClientesTable } from '@/components/terceros/ClientesTable';
import { RevendedoresTable } from '@/components/terceros/RevendedoresTable';
import { TodosTercerosTable } from '@/components/terceros/TodosTercerosTable';
import { TercerosMetrics } from '@/components/terceros/TercerosMetrics';
import { filterTercerosForTercerosPage, type TercerosTab } from '@/components/terceros/terceros-search';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invalidateVentasPorTercerosCache } from '@/hooks/use-ventas-por-terceros';
import { useTerceros } from '@/hooks/use-terceros';
import { useTercerosCounts } from '@/hooks/use-terceros-counts';
import { useServerPagination } from '@/hooks/useServerPagination';
import { queryKeys } from '@/lib/query-keys';
import { fetchMetodosPagoByFiltersUseCase } from '@/lib/use-cases/catalogos-use-cases';
import { TERCEROS_COLLECTION } from '@/lib/use-cases/terceros-use-cases';
import { FilterOption } from '@/lib/supabase/pagination';
import {
  getTerceroMetodoPagoNombre,
  isPendingTerceroPaymentMethodId,
  TERCERO_METODO_PAGO_UPDATED_EVENT,
  withPendingTerceroPaymentMethod,
} from '@/lib/utils/terceroMetodoPago';
import type { MetodoPago, Tercero } from '@/types';

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

const ALL_PAYMENT_METHODS_VALUE = 'todos';
const ALL_PAYMENT_METHODS_LABEL = 'Todos los métodos';

function TercerosPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: counts } = useTercerosCounts();
  const totalClientes = counts?.totalClientes ?? 0;
  const totalRevendedores = counts?.totalRevendedores ?? 0;
  const [activeTab, setActiveTab] = useState<TercerosTab>('todos');
  const [pageSize, setPageSize] = useState(10);
  const [searchPageIndex, setSearchPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [metodoPagoFilter, setMetodoPagoFilter] = useState(ALL_PAYMENT_METHODS_VALUE);
  const isSearchMode = searchQuery.trim().length > 0;
  const {
    data: terceros = [],
    isFetching: isLoadingTerceros,
    refetch: refetchTerceros,
  } = useTerceros({ enabled: isSearchMode });

  const {
    data: metodoPagoOptions = [
      { value: ALL_PAYMENT_METHODS_VALUE, label: ALL_PAYMENT_METHODS_LABEL },
    ],
    refetch: refetchMetodoPagoOptions,
  } = useQuery({
    queryKey: queryKeys.metodosPago.tercerosWithPending(),
    queryFn: async (): Promise<MetodoPagoFilterOption[]> => {
      const metodos = withPendingTerceroPaymentMethod(
        await fetchMetodosPagoByFiltersUseCase<MetodoPago>([
          { field: 'asociadoA', operator: '==', value: 'tercero' },
          { field: 'activo', operator: '==', value: true },
        ]),
      );

    const seen = new Set<string>();
    const options = metodos.reduce<MetodoPagoFilterOption[]>((acc, metodo) => {
      if (seen.has(metodo.id)) return acc;

      seen.add(metodo.id);
      acc.push({
        value: metodo.id,
        label: getTerceroMetodoPagoNombre(metodo.id, metodo.nombre),
      });
      return acc;
    }, []);

    return [
      { value: ALL_PAYMENT_METHODS_VALUE, label: ALL_PAYMENT_METHODS_LABEL },
      ...options,
    ];
    },
  });

  const selectedMetodoPagoFilter = useMemo(() => {
    if (
      metodoPagoFilter !== ALL_PAYMENT_METHODS_VALUE &&
      !metodoPagoOptions.some((option) => option.value === metodoPagoFilter)
    ) {
      return ALL_PAYMENT_METHODS_VALUE;
    }

    return metodoPagoFilter;
  }, [metodoPagoFilter, metodoPagoOptions]);

  // Filtros según tab activo
  const filters: FilterOption[] = useMemo(() => {
    const nextFilters: FilterOption[] = [];

    if (activeTab === 'clientes') {
      nextFilters.push({ field: 'tipo', operator: '==', value: 'cliente' });
    } else if (activeTab === 'revendedores') {
      nextFilters.push({ field: 'tipo', operator: '==', value: 'revendedor' });
    }

    if (selectedMetodoPagoFilter !== ALL_PAYMENT_METHODS_VALUE) {
      nextFilters.push(
        isPendingTerceroPaymentMethodId(selectedMetodoPagoFilter)
          ? { field: 'metodoPagoId', operator: 'is', value: null }
          : { field: 'metodoPagoId', operator: '==', value: selectedMetodoPagoFilter }
      );
    }

    return nextFilters;
  }, [activeTab, selectedMetodoPagoFilter]);

  // Paginación server-side con filtros y búsqueda en SQL.
  const { data: pageData, isLoading: isLoadingPage, hasMore, hasPrevious, page, totalPages: serverTotalPages, next, previous, refresh } = useServerPagination<Tercero>({
    collectionName: TERCEROS_COLLECTION,
    filters,
    pageSize,
    includeTotalCount: selectedMetodoPagoFilter !== ALL_PAYMENT_METHODS_VALUE,
  });

  const searchResults = useMemo(
    () =>
      filterTercerosForTercerosPage({
        terceros,
        searchQuery,
        activeTab,
        selectedMetodoPagoFilter,
        allPaymentMethodsValue: ALL_PAYMENT_METHODS_VALUE,
      }),
    [activeTab, searchQuery, selectedMetodoPagoFilter, terceros],
  );

  const searchStart = searchPageIndex * pageSize;
  const searchDisplayData = searchResults.slice(searchStart, searchStart + pageSize);

  const isLoading = isSearchMode ? isLoadingTerceros && terceros.length === 0 : isLoadingPage;
  const displayData = isSearchMode ? searchDisplayData : pageData;

  // Total según tab (para calcular páginas)
  const totalCurrentTab = activeTab === 'clientes' ? totalClientes : activeTab === 'revendedores' ? totalRevendedores : totalClientes + totalRevendedores;
  const totalPages = isSearchMode
      ? Math.max(1, Math.ceil(searchResults.length / pageSize))
      : selectedMetodoPagoFilter === ALL_PAYMENT_METHODS_VALUE
      ? Math.max(1, Math.ceil(totalCurrentTab / pageSize))
      : serverTotalPages;

  const paginationProps = {
    page: isSearchMode ? searchPageIndex + 1 : page,
    totalPages,
    hasPrevious: isSearchMode ? searchPageIndex > 0 : hasPrevious,
    hasMore: isSearchMode ? searchStart + pageSize < searchResults.length : hasMore,
    onPrevious: isSearchMode ? () => setSearchPageIndex((current) => Math.max(0, current - 1)) : previous,
    onNext: isSearchMode ? () => setSearchPageIndex((current) => current + 1) : next,
    pageSize,
    onPageSizeChange: (size: number) => {
      setPageSize(size);
      setSearchPageIndex(0);
      if (!isSearchMode) refresh();
    },
  };

  const handleRefresh = useCallback(() => {
    if (isSearchMode) {
      setSearchPageIndex(0);
      void refetchTerceros();
      return;
    }

    refresh();
  }, [isSearchMode, refresh, refetchTerceros]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as TercerosTab);
    setSearchQuery('');
    setSearchPageIndex(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchPageIndex(0);
  }, []);

  const handleMetodoPagoFilterChange = useCallback((value: string) => {
    setMetodoPagoFilter(value);
    setSearchPageIndex(0);
  }, []);

  // Escuchar cuando se elimina una venta en la MISMA página (ej: desde TerceroDetails)
  // La sincronización entre páginas diferentes ya la maneja useVentasPorTerceros via shouldInvalidateCache()
  useEffect(() => {
    const handleVentaDeleted = () => {
      invalidateVentasPorTercerosCache();
      refresh();
    };

    const handleTerceroDeleted = () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.terceros.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.terceros.counts() });
    };

    const handleTerceroMetodoPagoUpdated = () => {
      refresh();
      void refetchMetodoPagoOptions();
    };

    window.addEventListener('venta-deleted', handleVentaDeleted);
    window.addEventListener('tercero-deleted', handleTerceroDeleted);
    window.addEventListener(TERCERO_METODO_PAGO_UPDATED_EVENT, handleTerceroMetodoPagoUpdated);

    return () => {
      window.removeEventListener('venta-deleted', handleVentaDeleted);
      window.removeEventListener('tercero-deleted', handleTerceroDeleted);
      window.removeEventListener(TERCERO_METODO_PAGO_UPDATED_EVENT, handleTerceroMetodoPagoUpdated);
    };
  }, [queryClient, refetchMetodoPagoOptions, refresh]);

  const handleEdit = (usuario: Tercero) => {
    router.push(`/terceros/editar/${usuario.id}`);
  };

  const handleView = (usuario: Tercero) => {
    router.push(`/terceros/${usuario.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="dashboard-page-heading">
        <div className="dashboard-page-heading-row">
          <div className="dashboard-page-heading-copy space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Terceros</h1>
            <p className="text-sm text-muted-foreground">
              <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Terceros</span>
            </p>
          </div>
          <Link prefetch={false} href="/terceros/crear" className="shrink-0">
            <Button className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Tercero
            </Button>
          </Link>
        </div>
      </div>

      <TercerosMetrics />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
          <TodosTercerosTable
            terceros={displayData}
            onEdit={handleEdit}
            onView={handleView}
            title="Todos los terceros"
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <ClientesTable
            clientes={displayData}
            onEdit={handleEdit}
            onView={handleView}
            title="Clientes"
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>

        <TabsContent value="revendedores" className="space-y-4">
          <RevendedoresTable
            revendedores={displayData}
            onEdit={handleEdit}
            onView={handleView}
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TercerosPage() {
  return (
    <ModuleErrorBoundary moduleName="Terceros">
      <TercerosPageContent />
    </ModuleErrorBoundary>
  );
}
