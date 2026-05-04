'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ClientesTable } from '@/components/usuarios/ClientesTable';
import { RevendedoresTable } from '@/components/usuarios/RevendedoresTable';
import { TodosUsuariosTable } from '@/components/usuarios/TodosUsuariosTable';
import { UsuariosMetrics } from '@/components/usuarios/UsuariosMetrics';
import { useUsuariosStore } from '@/store/usuariosStore';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useServerPagination } from '@/hooks/useServerPagination';
import { invalidateVentasPorUsuariosCache } from '@/hooks/use-ventas-por-usuarios';
import { Usuario } from '@/types';
import { COLLECTIONS } from '@/lib/firebase/firestore';
import { FilterOption } from '@/lib/firebase/pagination';
import { normalizePhoneSearch, normalizeSearchText } from '@/lib/utils';
import {
  getUsuarioMetodoPagoNombre,
  isPendingUserPaymentMethodId,
  USUARIO_METODO_PAGO_UPDATED_EVENT,
  withPendingUserPaymentMethod,
} from '@/lib/utils/usuarioMetodoPago';

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

const ALL_PAYMENT_METHODS_VALUE = 'todos';
const ALL_PAYMENT_METHODS_LABEL = 'Todos los métodos';

function UsuariosPageContent() {
  const router = useRouter();
  const { totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos, fetchCounts, fetchUsuarios, usuarios } = useUsuariosStore();
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
      nextFilters.push({ field: 'metodoPagoId', operator: '==', value: selectedMetodoPagoFilter });
    }

    return nextFilters;
  }, [activeTab, selectedMetodoPagoFilter]);

  // Paginación server-side (solo cuando NO hay búsqueda activa)
  const { data: pageData, isLoading: isLoadingPage, hasMore, hasPrevious, page, next, previous, refresh } = useServerPagination<Usuario>({
    collectionName: COLLECTIONS.USUARIOS,
    filters,
    pageSize,
  });

  // Modo búsqueda: fetchAll con cache y filtrar en memoria
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  useEffect(() => {
    if (!isSearchMode) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingSearch(true);
      await fetchUsuarios();
      if (!cancelled) setIsLoadingSearch(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isSearchMode, fetchUsuarios]);

  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    const q = normalizeSearchText(searchQuery);
    const phoneQuery = normalizePhoneSearch(searchQuery);
    const base = activeTab === 'clientes'
      ? usuarios.filter(u => u.tipo === 'cliente')
      : activeTab === 'revendedores'
        ? usuarios.filter(u => u.tipo === 'revendedor')
        : usuarios;
    return base.filter(u => {
      const metodoMatches = selectedMetodoPagoFilter === ALL_PAYMENT_METHODS_VALUE
        ? true
        : isPendingUserPaymentMethodId(selectedMetodoPagoFilter)
          ? isPendingUserPaymentMethodId(u.metodoPagoId)
          : u.metodoPagoId === selectedMetodoPagoFilter;
      const nombreCompleto = normalizeSearchText(`${u.nombre} ${u.apellido ?? ''}`);
      const nombre = normalizeSearchText(u.nombre);
      const apellido = normalizeSearchText(u.apellido);
      const telefono = normalizePhoneSearch(u.telefono);
      return (
        metodoMatches &&
        (
          nombreCompleto.includes(q) ||
          nombre.includes(q) ||
          apellido.includes(q) ||
          (phoneQuery.length > 0 && telefono.includes(phoneQuery))
        )
      );
    });
  }, [isSearchMode, searchQuery, usuarios, activeTab, selectedMetodoPagoFilter]);

  const isLoading = isSearchMode ? isLoadingSearch : isLoadingPage;
  const displayData = isSearchMode ? searchResults : pageData;

  // Total según tab (para calcular páginas)
  const totalCurrentTab = activeTab === 'clientes' ? totalClientes : activeTab === 'revendedores' ? totalRevendedores : totalClientes + totalRevendedores;
  const totalPages = isSearchMode
    ? Math.max(1, Math.ceil(searchResults.length / pageSize))
    : selectedMetodoPagoFilter === ALL_PAYMENT_METHODS_VALUE
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
            pagination={isSearchMode ? undefined : paginationProps}
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
            pagination={isSearchMode ? undefined : paginationProps}
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
            pagination={isSearchMode ? undefined : paginationProps}
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
