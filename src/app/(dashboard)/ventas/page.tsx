'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateInitialPageSize } from '@/hooks/use-fit-page-size';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { ConfirmDeleteVentaDialog } from '@/components/shared/ConfirmDeleteVentaDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { VentasNavigation } from '@/components/ventas/VentasNavigation';
import { VentasMetrics } from '@/components/ventas/VentasMetrics';
import { VentasTable } from '@/components/ventas/VentasTable';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { deleteVentaMutation } from '@/application/client-domain-mutations';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { subscribeToVentaListReactions } from '@/platform/events/cache-reactions';
import { reportError } from '@/platform/observability/logger';
import { queryKeys } from '@/platform/query-keys';
import { VENTAS_COLLECTION } from '@/application/use-cases/ventas/ventas-query-use-cases';
import { VentaDoc } from '@/types';
import type { FilterOption } from '@/types/pagination';

function VentasPageContent() {
  const queryClient = useQueryClient();
  const { data: categorias = [] } = useCategoriasFull();

  const [activeTab, setActiveTab] = useState<'todas' | 'activas' | 'inactivas'>('todas');
  const [pageSize, setPageSize] = useState(() => estimateInitialPageSize());
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
      await deleteVentaMutation(deleteVentaId, deleteVentaServicioId, deleteVentaPerfilNumero, deletePagos);
      toast.success(deletePagos ? 'Venta y pagos eliminados' : 'Venta eliminada', { description: deletePagos ? 'La venta y todos sus pagos asociados han sido eliminados.' : 'La venta ha sido eliminada. Los pagos se conservaron.' });
      setDeleteVentaId(null);
      setDeleteVentaServicioId(undefined);
      setDeleteVentaPerfilNumero(undefined);
      setDeleteDialogOpen(false);
      // Refrescar la lista y las métricas después de eliminar
      refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventas.counts() });
    } catch (error) {
      reportError('VentasPage', 'Error eliminando venta', error);
      toast.error('Error eliminando venta', { description: getPublicErrorMessage(error, 'No se pudo eliminar la venta.') });
    }
  };

  useEffect(() => {
    return subscribeToVentaListReactions(queryClient, refresh);
  }, [queryClient, refresh]);

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Ventas"
          actions={
            <Button asChild className="whitespace-nowrap">
              <Link prefetch={false} href="/ventas/crear">
                <Plus />
                Nueva Venta
              </Link>
            </Button>
          }
        />

        <VentasMetrics />

        <VentasNavigation />
          <VentasTable
            estado={activeTab}
            onEstadoChange={setActiveTab}
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
            onPageSizeChange={setPageSize}
          />
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
