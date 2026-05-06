'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { ClientesTable } from '@/components/usuarios/ClientesTable';
import { RevendedoresTable } from '@/components/usuarios/RevendedoresTable';
import { TodosUsuariosTable } from '@/components/usuarios/TodosUsuariosTable';
import { UsuariosMetrics } from '@/components/usuarios/UsuariosMetrics';
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
  const { totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos, fetchCounts } = useUsuariosStore();
  const { fetchMetodosPagoUsuarios } = useMetodosPagoStore();

  const [activeTab, setActiveTab] = useState('todos');
  const [pageSize, setPageSize] = useState(10);
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

    if (isSearchMode) {
      nextFilters.push({
        field: '__search__',
        operator: 'orIlike',
        value: {
          fields: ['nombre', 'apellido', 'telefono'],
          value: searchQuery,
        },
      });
    }

    return nextFilters;
  }, [activeTab, isSearchMode, searchQuery, selectedMetodoPagoFilter]);

  // Paginación server-side con filtros y búsqueda en SQL.
  const { data: pageData, isLoading: isLoadingPage, hasMore, hasPrevious, page, next, previous, refresh } = useServerPagination<Usuario>({
    collectionName: USUARIOS_COLLECTION,
    filters,
    pageSize,
  });

  const isLoading = isLoadingPage;
  const displayData = pageData;

  // Total según tab (para calcular páginas)
  const totalCurrentTab = activeTab === 'clientes' ? totalClientes : activeTab === 'revendedores' ? totalRevendedores : totalClientes + totalRevendedores;
  const totalPages = selectedMetodoPagoFilter === ALL_PAYMENT_METHODS_VALUE && !isSearchMode
      ? Math.max(1, Math.ceil(totalCurrentTab / pageSize))
      : Math.max(1, hasMore ? page + 1 : page);

  const paginationProps = { page, totalPages, hasPrevious, hasMore, onPrevious: previous, onNext: next, pageSize, onPageSizeChange: (size: number) => { setPageSize(size); refresh(); } };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Usuarios</span>
          </p>
        </div>
        <Link href="/usuarios/crear" className="self-start sm:self-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
        </Link>
      </div>

      <UsuariosMetrics
        totalClientes={totalClientes}
        totalRevendedores={totalRevendedores}
        usuariosActivos={totalUsuariosActivos}
        totalNuevosHoy={totalNuevosHoy}
      />

      <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setSearchQuery(''); }}>
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
            onSearchChange={setSearchQuery}
            onRefresh={refresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={setMetodoPagoFilter}
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
            onSearchChange={setSearchQuery}
            onRefresh={refresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={setMetodoPagoFilter}
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
            onSearchChange={setSearchQuery}
            onRefresh={refresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={setMetodoPagoFilter}
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
