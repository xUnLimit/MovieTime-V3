'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { ConfirmDeleteVentaDialog } from '@/components/shared/ConfirmDeleteVentaDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VentasMetrics } from '@/components/ventas/VentasMetrics';
import { VentasTable } from '@/components/ventas/VentasTable';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { useServerPagination } from '@/hooks/useServerPagination';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';
import { VENTAS_COLLECTION } from '@/lib/use-cases/ventas-use-cases';
import { useVentasStore } from '@/store/ventasStore';
import { VentaDoc } from '@/types';
import { FilterOption } from '@/lib/supabase/pagination';

function VentasPageContent() {
  const queryClient = useQueryClient();
  const deleteVenta = useVentasStore((state) => state.deleteVenta);
  const { data: categorias = [] } = useCategoriasFull();

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
    if (isSearchMode) {
      f.push({
        field: '__search__',
        operator: 'orIlike',
        value: {
          fields: ['clienteNombre', 'servicioNombre', 'servicioCorreo'],
          value: searchQuery,
        },
      });
    }
    return f;
  }, [activeTab, isCategoriaFiltered, isSearchMode, searchQuery, selectedCategoriaId]);

  // Paginación server-side con filtros y búsqueda en SQL.
  const { data: ventasPaginadas, isLoading: isLoadingPage, hasMore, page, totalPages, hasPrevious, next, previous, refresh } = useServerPagination<VentaDoc>({
    collectionName: VENTAS_COLLECTION,
    filters,
    pageSize,
    orderByField: orderBy,
    orderDirection: 'desc',
    includeTotalCount: true,
  });

  // Recargar ventas si se actualizó el nombre de un cliente desde el módulo de terceros
  useEffect(() => {
    const unsubscribe = storeEventBus.on('TERCERO_NOMBRE_UPDATED', () => {
      refresh();
    });

    return unsubscribe;
  }, [refresh]);

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventas.counts() });
    } catch (error) {
      console.error('Error eliminando venta:', error);
      toast.error('Error eliminando venta', { description: error instanceof Error ? error.message : undefined });
    }
  };

  // Escuchar eventos de cambios en ventas desde otros módulos
  useEffect(() => {
    const handleVentaChange = () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventas.counts() });
    };

    const unsubscribeCreated = storeEventBus.on('VENTA_CREATED', handleVentaChange);
    const unsubscribeUpdated = storeEventBus.on('VENTA_UPDATED', handleVentaChange);
    const unsubscribeDeleted = storeEventBus.on('VENTA_DELETED', handleVentaChange);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [queryClient, refresh]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ventas</h1>
            <p className="text-sm text-muted-foreground">
              <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Ventas</span>
            </p>
          </div>
          <Link prefetch={false} href="/ventas/crear" className="shrink-0">
            <Button className="whitespace-nowrap">
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
            ventas={ventasPaginadas}
            isLoading={isLoadingPage}
            title={tituloTab}
            onDelete={handleDeleteVenta}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categorias={categorias}
            selectedCategoriaId={selectedCategoriaId}
            onCategoriaChange={(id) => { setSelectedCategoriaId(id); }}
            orderBy={orderBy}
            onOrderByChange={setOrderBy}
            hasMore={hasMore}
            hasPrevious={hasPrevious}
            page={page}
            totalPages={totalPages}
            onNext={next}
            onPrevious={previous}
            showPagination
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
