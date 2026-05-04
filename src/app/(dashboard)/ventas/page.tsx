'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteVentaDialog } from '@/components/shared/ConfirmDeleteVentaDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { VentasTable } from '@/components/ventas/VentasTable';
import { VentasMetrics } from '@/components/ventas/VentasMetrics';
import { useServerPagination } from '@/hooks/useServerPagination';
import { useVentasStore } from '@/store/ventasStore';
import { useCategoriasStore } from '@/store/categoriasStore';
import { toast } from 'sonner';
import { COLLECTIONS } from '@/lib/firebase/firestore';
import { normalizeSearchText } from '@/lib/utils';
import { VentaDoc } from '@/types';
import { FilterOption } from '@/lib/firebase/pagination';
import { getVentasConUltimoPago, VentaConUltimoPago } from '@/lib/services/ventaSyncService';

function VentasPageContent() {
  const { deleteVenta, fetchCounts, fetchVentas, ventas } = useVentasStore();
  const { categorias, fetchCategorias } = useCategoriasStore();

  const [activeTab, setActiveTab] = useState<'todas' | 'activas' | 'inactivas'>('todas');
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('todas');
  const [orderBy, setOrderBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const isCategoriaFiltered = selectedCategoriaId !== 'todas';
  const isSearchMode = searchQuery.trim().length > 0;
  const [deleteVentaId, setDeleteVentaId] = useState<string | null>(null);
  const [deleteVentaServicioId, setDeleteVentaServicioId] = useState<string | undefined>(undefined);
  const [deleteVentaPerfilNumero, setDeleteVentaPerfilNumero] = useState<number | null | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Construir filtros basados en el tab activo y categoría seleccionada
  const filters = useMemo((): FilterOption[] => {
    const f: FilterOption[] = [];
    if (activeTab === 'activas') {
      f.push({ field: 'estado', operator: '==', value: 'activo' });
    } else if (activeTab === 'inactivas') {
      f.push({ field: 'estado', operator: '==', value: 'inactivo' });
    }
    if (isCategoriaFiltered) {
      f.push({ field: 'categoriaId', operator: '==', value: selectedCategoriaId });
    }
    return f;
  }, [activeTab, isCategoriaFiltered, selectedCategoriaId]);

  // Paginación server-side (solo cuando NO hay búsqueda activa)
  const { data: ventasPaginadas, isLoading: isLoadingPage, hasMore, page, hasPrevious, next, previous, refresh } = useServerPagination<VentaDoc>({
    collectionName: COLLECTIONS.VENTAS,
    filters,
    pageSize,
    orderByField: orderBy,
    orderDirection: 'desc',
  });

  // Cargar categorías al montar
  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  // Recargar ventas si se actualizó el nombre de un cliente desde el módulo de usuarios
  useEffect(() => {
    const handler = () => {
      fetchVentas(true);
      refresh();
    };
    window.addEventListener('usuario-nombre-updated', handler);
    return () => window.removeEventListener('usuario-nombre-updated', handler);
  }, [fetchVentas, refresh]);

  // Modo búsqueda/filtro: fetchAll con cache y filtrar en memoria
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  useEffect(() => {
    if (!isSearchMode) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingSearch(true);
      await fetchVentas();
      if (!cancelled) setIsLoadingSearch(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isSearchMode, fetchVentas]);

  const searchResults = useMemo((): VentaDoc[] => {
    if (!isSearchMode) return [];
    const q = normalizeSearchText(searchQuery);
    let base = activeTab === 'activas'
      ? ventas.filter(v => v.estado === 'activo')
      : activeTab === 'inactivas'
        ? ventas.filter(v => v.estado === 'inactivo')
        : ventas;
    if (isCategoriaFiltered) {
      base = base.filter(v => v.categoriaId === selectedCategoriaId);
    }
    if (q) {
      base = base.filter(v =>
        normalizeSearchText(v.clienteNombre).includes(q) ||
        normalizeSearchText(v.servicioNombre).includes(q) ||
        normalizeSearchText(v.servicioCorreo).includes(q)
      );
    }
    return base.sort((a, b) => {
      const field = orderBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
      const dateA = a[field] ? new Date(a[field] as Date).getTime() : 0;
      const dateB = b[field] ? new Date(b[field] as Date).getTime() : 0;
      return dateB - dateA;
    });
  }, [isSearchMode, searchQuery, ventas, activeTab, isCategoriaFiltered, selectedCategoriaId, orderBy]);

  const ventasParaMostrar = isSearchMode ? searchResults : ventasPaginadas;
  const isLoadingVentas = isSearchMode ? isLoadingSearch : isLoadingPage;

  // Cargar datos del último pago desde PagoVenta
  const [ventasConUltimoPago, setVentasConUltimoPago] = useState<VentaConUltimoPago[]>([]);
  const [loadingDatos, setLoadingDatos] = useState(false);

  useEffect(() => {
    const cargarDatosUltimoPago = async () => {
      if (ventasParaMostrar.length === 0) {
        setVentasConUltimoPago([]);
        return;
      }

      setLoadingDatos(true);
      try {
        const ventasConPagoActual = await getVentasConUltimoPago(ventasParaMostrar);
        setVentasConUltimoPago(ventasConPagoActual);
      } catch (error) {
        console.error('Error cargando datos del último pago de ventas:', error);
        setVentasConUltimoPago(ventasParaMostrar as VentaConUltimoPago[]);
      } finally {
        setLoadingDatos(false);
      }
    };

    cargarDatosUltimoPago();
  }, [ventasParaMostrar]);

  const tituloTab = useMemo(() => {
    switch (activeTab) {
      case 'activas':
        return 'Ventas Activas';
      case 'inactivas':
        return 'Ventas Inactivas';
      default:
        return 'Todas las Ventas';
    }
  }, [activeTab]);

  const handleDeleteVenta = (ventaId: string, servicioId?: string, perfilNumero?: number | null) => {
    setDeleteVentaId(ventaId);
    setDeleteVentaServicioId(servicioId);
    setDeleteVentaPerfilNumero(perfilNumero ?? null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeleteVenta = async (deletePagos: boolean) => {
    if (!deleteVentaId) return;
    try {
      await deleteVenta(deleteVentaId, deleteVentaServicioId, deleteVentaPerfilNumero, deletePagos);
      toast.success(deletePagos ? 'Venta y pagos eliminados' : 'Venta eliminada', { description: deletePagos ? 'La venta y todos sus pagos asociados han sido eliminados.' : 'La venta ha sido eliminada. Los pagos se conservaron.' });
      setDeleteVentaId(null);
      setDeleteVentaServicioId(undefined);
      setDeleteVentaPerfilNumero(undefined);
      setDeleteDialogOpen(false);
      // Refrescar la lista y las métricas después de eliminar
      refresh();
      fetchCounts();
    } catch (error) {
      console.error('Error eliminando venta:', error);
      toast.error('Error eliminando venta', { description: error instanceof Error ? error.message : undefined });
    }
  };

  // Escuchar eventos de cambios en ventas desde otros módulos
  useEffect(() => {
    const handleVentaChange = () => {
      refresh();
      fetchCounts();
    };

    window.addEventListener('venta-created', handleVentaChange);
    window.addEventListener('venta-updated', handleVentaChange);
    window.addEventListener('venta-deleted', handleVentaChange);

    return () => {
      window.removeEventListener('venta-created', handleVentaChange);
      window.removeEventListener('venta-updated', handleVentaChange);
      window.removeEventListener('venta-deleted', handleVentaChange);
    };
  }, [refresh, fetchCounts]);

  return (
    <>
      <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Ventas</span>
          </p>
        </div>
        <Link href="/ventas/crear" className="self-start sm:self-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        </Link>
      </div>

      <VentasMetrics />

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as typeof activeTab); setSearchQuery(''); setSelectedCategoriaId('todas'); }}>
        <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="todas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Todas
          </TabsTrigger>
          <TabsTrigger
            value="activas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Activas
          </TabsTrigger>
          <TabsTrigger
            value="inactivas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Inactivas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <VentasTable
            ventas={ventasConUltimoPago}
            isLoading={isLoadingVentas || loadingDatos}
            title={tituloTab}
            onDelete={handleDeleteVenta}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categorias={categorias}
            selectedCategoriaId={selectedCategoriaId}
            onCategoriaChange={(id) => { setSelectedCategoriaId(id); }}
            orderBy={orderBy}
            onOrderByChange={setOrderBy}
            // Paginación (oculta en modo búsqueda/filtro)
            hasMore={isSearchMode ? false : hasMore}
            hasPrevious={isSearchMode ? false : hasPrevious}
            page={isSearchMode ? 1 : page}
            onNext={next}
            onPrevious={previous}
            showPagination={!isSearchMode}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); refresh(); }}
          />
        </TabsContent>
      </Tabs>
    </div>
    <ConfirmDeleteVentaDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteVentaId(null);
            setDeleteVentaServicioId(undefined);
            setDeleteVentaPerfilNumero(undefined);
          }
        }}
        onConfirm={handleConfirmDeleteVenta}
      />
    </>
  );
}

export default function VentasPage() {
  return (
    <ModuleErrorBoundary moduleName="Ventas">
      <VentasPageContent />
    </ModuleErrorBoundary>
  );
}
