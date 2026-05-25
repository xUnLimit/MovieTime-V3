'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { filterTercerosForTercerosPage, type TercerosTab } from '@/components/terceros/terceros-search';
import { useTerceros } from '@/hooks/use-terceros';
import { useTercerosCounts } from '@/hooks/use-terceros-counts';
import { useServerPagination } from '@/hooks/useServerPagination';
import { subscribeToTercerosPageReactions } from '@/lib/events/cache-reactions';
import { queryKeys } from '@/lib/query-keys';
import { queryMetodosPagoTercerosRead } from '@/lib/supabase/domain-read-adapters';
import { FilterOption } from '@/lib/supabase/pagination';
import { TERCEROS_COLLECTION } from '@/lib/use-cases/terceros-use-cases';
import {
  getTerceroMetodoPagoNombre,
  isPendingTerceroPaymentMethodId,
  withPendingTerceroPaymentMethod,
} from '@/lib/utils/terceroMetodoPago';
import type { Tercero } from '@/types';

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

const ALL_PAYMENT_METHODS_VALUE = 'todos';
const ALL_PAYMENT_METHODS_LABEL = 'Todos los métodos';

export function useTercerosPageController() {
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
    queryFn: buildMetodoPagoOptions,
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

  const filters: FilterOption[] = useMemo(
    () => buildTercerosFilters(activeTab, selectedMetodoPagoFilter),
    [activeTab, selectedMetodoPagoFilter],
  );

  const {
    data: pageData,
    isLoading: isLoadingPage,
    hasMore,
    hasPrevious,
    page,
    totalPages: serverTotalPages,
    next,
    previous,
    refresh,
  } = useServerPagination<Tercero>({
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
  const totalCurrentTab = getTotalForTab(activeTab, totalClientes, totalRevendedores);
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

  useEffect(() => {
    return subscribeToTercerosPageReactions({
      queryClient,
      refresh,
      refetchMetodoPagoOptions,
    });
  }, [queryClient, refetchMetodoPagoOptions, refresh]);

  const handleEdit = (usuario: Tercero) => {
    router.push(`/terceros/editar/${usuario.id}`);
  };

  const handleView = (usuario: Tercero) => {
    router.push(`/terceros/${usuario.id}`);
  };

  return {
    activeTab,
    displayData,
    handleEdit,
    handleMetodoPagoFilterChange,
    handleRefresh,
    handleSearchChange,
    handleTabChange,
    handleView,
    isLoading,
    metodoPagoOptions,
    paginationProps,
    searchQuery,
    selectedMetodoPagoFilter,
  };
}

export type TercerosPageController = ReturnType<typeof useTercerosPageController>;

async function buildMetodoPagoOptions(): Promise<MetodoPagoFilterOption[]> {
  const metodos = withPendingTerceroPaymentMethod(
    await queryMetodosPagoTercerosRead({ soloActivos: true }),
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
}

function buildTercerosFilters(
  activeTab: TercerosTab,
  selectedMetodoPagoFilter: string,
): FilterOption[] {
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
        : { field: 'metodoPagoId', operator: '==', value: selectedMetodoPagoFilter },
    );
  }

  return nextFilters;
}

function getTotalForTab(
  activeTab: TercerosTab,
  totalClientes: number,
  totalRevendedores: number,
) {
  if (activeTab === 'clientes') return totalClientes;
  if (activeTab === 'revendedores') return totalRevendedores;
  return totalClientes + totalRevendedores;
}
