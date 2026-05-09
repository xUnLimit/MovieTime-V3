'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { ClientesTable } from '@/components/usuarios/ClientesTable';
import { RevendedoresTable } from '@/components/usuarios/RevendedoresTable';
import { TodosUsuariosTable } from '@/components/usuarios/TodosUsuariosTable';
import { UsuariosMetrics } from '@/components/usuarios/UsuariosMetrics';
import { filterUsuariosForUsuariosPage, type UsuariosTab } from '@/components/usuarios/usuarios-search';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invalidateVentasPorUsuariosCache } from '@/hooks/use-ventas-por-usuarios';
import { useServerPagination } from '@/hooks/useServerPagination';
import { USUARIOS_COLLECTION } from '@/lib/use-cases/usuarios-use-cases';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { useUsuariosStore } from '@/store/usuariosStore';
import { FilterOption } from '@/lib/supabase/pagination';
import {
  getUsuarioMetodoPagoNombre,
  isPendingUserPaymentMethodId,
  USUARIO_METODO_PAGO_UPDATED_EVENT,
  withPendingUserPaymentMethod,
} from '@/lib/utils/usuarioMetodoPago';
import type { Usuario } from '@/types';

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

const ALL_PAYMENT_METHODS_VALUE = 'todos';
const ALL_PAYMENT_METHODS_LABEL = 'Todos los métodos';

function UsuariosPageContent() {
  const router = useRouter();
  const {
    totalClientes,
    totalRevendedores,
    totalNuevosHoy,
    totalUsuariosActivos,
    usuarios,
    fetchUsuarios,
    fetchCounts,
    isLoading: isLoadingUsuarios,
  } = useUsuariosStore();
  const { fetchMetodosPagoUsuarios } = useMetodosPagoStore();

  const [activeTab, setActiveTab] = useState<UsuariosTab>('todos');
  const [pageSize, setPageSize] = useState(10);
  const [searchPageIndex, setSearchPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [metodoPagoFilter, setMetodoPagoFilter] = useState(ALL_PAYMENT_METHODS_VALUE);
  const [metodoPagoOptions, setMetodoPagoOptions] = useState<MetodoPagoFilterOption[]>([
    { value: ALL_PAYMENT_METHODS_VALUE, label: ALL_PAYMENT_METHODS_LABEL },
  ]);
  const isSearchMode = searchQuery.trim().length > 0;

  const fetchMetodoPagoOptions = useCallback(async (): Promise<MetodoPagoFilterOption[]> => {
    const metodos = withPendingUserPaymentMethod(await fetchMetodosPagoUsuarios());
    const seen = new Set<string>();
    const options = metodos.reduce<MetodoPagoFilterOption[]>((acc, metodo) => {
      if (seen.has(metodo.id)) return acc;

      seen.add(metodo.id);
      acc.push({
        value: metodo.id,
        label: getUsuarioMetodoPagoNombre(metodo.id, metodo.nombre),
      });
      return acc;
    }, []);

    return [
      { value: ALL_PAYMENT_METHODS_VALUE, label: ALL_PAYMENT_METHODS_LABEL },
      ...options,
    ];
  }, [fetchMetodosPagoUsuarios]);

  useEffect(() => {
    let cancelled = false;

    const loadMetodoPagoOptions = async () => {
      const options = await fetchMetodoPagoOptions();
      if (!cancelled) {
        setMetodoPagoOptions(options);
      }
    };

    void loadMetodoPagoOptions();

    return () => {
      cancelled = true;
    };
  }, [fetchMetodoPagoOptions]);

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
        isPendingUserPaymentMethodId(selectedMetodoPagoFilter)
          ? { field: 'metodoPagoId', operator: 'is', value: null }
          : { field: 'metodoPagoId', operator: '==', value: selectedMetodoPagoFilter }
      );
    }

    return nextFilters;
  }, [activeTab, selectedMetodoPagoFilter]);

  // Paginación server-side con filtros y búsqueda en SQL.
  const { data: pageData, isLoading: isLoadingPage, hasMore, hasPrevious, page, next, previous, refresh } = useServerPagination<Usuario>({
    collectionName: USUARIOS_COLLECTION,
    filters,
    pageSize,
  });

  useEffect(() => {
    if (isSearchMode) {
      void fetchUsuarios();
    }
  }, [fetchUsuarios, isSearchMode]);

  const searchResults = useMemo(
    () =>
      filterUsuariosForUsuariosPage({
        usuarios,
        searchQuery,
        activeTab,
        selectedMetodoPagoFilter,
        allPaymentMethodsValue: ALL_PAYMENT_METHODS_VALUE,
      }),
    [activeTab, searchQuery, selectedMetodoPagoFilter, usuarios],
  );

  const searchStart = searchPageIndex * pageSize;
  const searchDisplayData = searchResults.slice(searchStart, searchStart + pageSize);

  const isLoading = isSearchMode ? isLoadingUsuarios && usuarios.length === 0 : isLoadingPage;
  const displayData = isSearchMode ? searchDisplayData : pageData;

  // Total según tab (para calcular páginas)
  const totalCurrentTab = activeTab === 'clientes' ? totalClientes : activeTab === 'revendedores' ? totalRevendedores : totalClientes + totalRevendedores;
  const totalPages = isSearchMode
      ? Math.max(1, Math.ceil(searchResults.length / pageSize))
      : selectedMetodoPagoFilter === ALL_PAYMENT_METHODS_VALUE
      ? Math.max(1, Math.ceil(totalCurrentTab / pageSize))
      : Math.max(1, hasMore ? page + 1 : page);

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
      void fetchUsuarios(true);
      return;
    }

    refresh();
  }, [fetchUsuarios, isSearchMode, refresh]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as UsuariosTab);
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
    fetchCounts();
  }, [fetchCounts]);

  // Escuchar cuando se elimina una venta en la MISMA página (ej: desde UsuarioDetails)
  // La sincronización entre páginas diferentes ya la maneja useVentasPorUsuarios via shouldInvalidateCache()
  useEffect(() => {
    const handleVentaDeleted = () => {
      invalidateVentasPorUsuariosCache();
      refresh();
    };

    const handleUsuarioMetodoPagoUpdated = () => {
      refresh();
      void fetchMetodoPagoOptions().then(setMetodoPagoOptions);
    };

    window.addEventListener('venta-deleted', handleVentaDeleted);
    window.addEventListener(USUARIO_METODO_PAGO_UPDATED_EVENT, handleUsuarioMetodoPagoUpdated);

    return () => {
      window.removeEventListener('venta-deleted', handleVentaDeleted);
      window.removeEventListener(USUARIO_METODO_PAGO_UPDATED_EVENT, handleUsuarioMetodoPagoUpdated);
    };
  }, [fetchMetodoPagoOptions, refresh]);

  const handleEdit = (usuario: Usuario) => {
    router.push(`/usuarios/editar/${usuario.id}`);
  };

  const handleView = (usuario: Usuario) => {
    router.push(`/usuarios/${usuario.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="dashboard-page-heading">
        <div className="dashboard-page-heading-row">
          <div className="dashboard-page-heading-copy">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          </div>
          <Link prefetch={false} href="/usuarios/crear" className="shrink-0">
            <Button className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Usuarios</span>
        </p>
      </div>

      <UsuariosMetrics
        totalClientes={totalClientes}
        totalRevendedores={totalRevendedores}
        usuariosActivos={totalUsuariosActivos}
        totalNuevosHoy={totalNuevosHoy}
      />

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
          <TodosUsuariosTable
            usuarios={displayData}
            onEdit={handleEdit}
            onView={handleView}
            title="Todos los usuarios"
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

export default function UsuariosPage() {
  return (
    <ModuleErrorBoundary moduleName="Usuarios">
      <UsuariosPageContent />
    </ModuleErrorBoundary>
  );
}
