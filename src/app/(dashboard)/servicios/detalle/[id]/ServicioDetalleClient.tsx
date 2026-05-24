'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useMetodosPagoServicios } from '@/hooks/use-metodos-pago-servicios';
import { usePagosServicio } from '@/hooks/use-pagos-servicio';
import { getCurrencySymbol } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useTercerosStore } from '@/store/tercerosStore';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';
import type { Servicio } from '@/types';

import { ServicioDetalleDialogs } from './components/ServicioDetalleDialogs';
import { ServicioDetalleHeader } from './components/ServicioDetalleHeader';
import { ServicioLoadingState, ServicioNotFoundState } from './components/ServicioDetalleStates';
import { ServicioPaymentsHistory } from './components/ServicioPaymentsHistory';
import { ServicioProfilesSection } from './components/ServicioProfilesSection';
import {
  CutVentaDialog,
  TransferVentaDialog,
} from './components/ServicioSaleActionsDialogs';
import { ServicioSummaryCards } from './components/ServicioSummaryCards';
import type { CategoriaDetalle, MetodoPagoDetalle, PerfilVenta } from './components/types';
import { useServicioPaymentActions } from './components/useServicioPaymentActions';
import { useServicioProfiles } from './components/useServicioProfiles';
import { useServicioSaleActions } from './components/useServicioSaleActions';
import { useTotalGastadoUSD } from './components/useTotalGastadoUSD';
import {
  fetchServicioDetalleBundle,
  fetchServicioVentasProfiles,
  getCicloPagoLabel,
  getReturnToServicios,
  sortPagosServicioByNewest,
} from './servicio-detalle-helpers';

function ServicioDetallePageBody({ id, from }: { id: string; from: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { deleteServicio, fetchCounts, fetchServicios, servicios } = useServiciosStore();
  const deleteNotificacionesPorServicio = useNotificacionesStore(
    (state) => state.deleteNotificacionesPorServicio,
  );
  const fetchTemplates = useTemplatesStore((state) => state.fetchTemplates);
  const getTemplateByTipo = useTemplatesStore((state) => state.getTemplateByTipo);
  const fetchTerceros = useTercerosStore((state) => state.fetchTerceros);
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);

  // Estados locales para los datos específicos de esta página
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDetalle | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoDetalle | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);
  const [ventasServicio, setVentasServicio] = useState<Array<PerfilVenta & { perfilNumero?: number | null }>>([]);

  const {
    cutVentaDialogOpen,
    handleConfirmCutVenta,
    handleConfirmTransferVenta,
    handleOpenCutVenta,
    handleOpenTransferVenta,
    isSaleActionSubmitting,
    selectedActionVenta,
    setCutVentaDialogOpen,
    setSelectedActionVenta,
    setTransferVentaDialogOpen,
    transferVentaDialogOpen,
  } = useServicioSaleActions({
    enqueueWhatsAppMessages,
    fetchServicios,
    fetchTemplates,
    fetchTerceros,
    getTemplateByTipo,
    queryClient,
    setVentasServicio,
  });

  // Usar el hook para cargar pagos (con cache)
  const { pagos: pagosServicio, isLoading: pagosHistorialLoading, renovaciones, refresh: refreshPagos } = usePagosServicio(id);
  const { data: metodosPago = [] } = useMetodosPagoServicios();
  const {
    data: servicioDetalleBundle,
    error: servicioDetalleError,
    isError: isServicioDetalleError,
    isLoading: isLoadingData,
  } = useQuery({
    queryKey: queryKeys.servicios.detailBundle(id),
    queryFn: () => fetchServicioDetalleBundle(id),
    enabled: Boolean(id),
  });
  const {
    data: ventasServicioQueryData = [],
    error: ventasServicioError,
    isError: isVentasServicioError,
  } = useQuery({
    queryKey: queryKeys.servicios.ventas(id),
    queryFn: () => fetchServicioVentasProfiles(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!servicioDetalleBundle) return;
    setServicio(servicioDetalleBundle.servicio);
    setCategoria(servicioDetalleBundle.categoria);
    setMetodoPago(servicioDetalleBundle.metodoPago);
  }, [servicioDetalleBundle]);

  useEffect(() => {
    if (!isServicioDetalleError) return;
    console.error('Error cargando datos del servicio:', servicioDetalleError);
    toast.error('Error al cargar el servicio', {
      description: 'Ocurrió un problema al obtener los datos. Intenta nuevamente.',
    });
    setServicio(null);
  }, [isServicioDetalleError, servicioDetalleError]);

  useEffect(() => {
    setVentasServicio(ventasServicioQueryData);
  }, [ventasServicioQueryData]);

  useEffect(() => {
    if (!isVentasServicioError) return;
    console.error('Error cargando ventas del servicio:', ventasServicioError);
    toast.error('Error cargando ventas del servicio', {
      description: ventasServicioError instanceof Error ? ventasServicioError.message : undefined,
    });
    setVentasServicio([]);
  }, [isVentasServicioError, ventasServicioError]);

  const handleDelete = () => {
    setDeletePayments(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteServicio(id, deletePayments);
      if (deletePayments) {
        toast.success('Servicio eliminado', { description: 'El servicio y todos sus registros de pago han sido eliminados.' });
      } else {
        toast.success('Servicio eliminado', { description: 'El servicio fue eliminado. Los registros de pago se conservaron.' });
      }

      // Refrescar categorías y contadores de servicios para actualizar widgets
      await Promise.all([
        fetchCounts(true),
        queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
      ]);

      router.push('/servicios');
    } catch (error) {
      toast.error('Error al eliminar servicio', { description: error instanceof Error ? error.message : undefined });
    }
  };


  const currencySymbol = getCurrencySymbol(metodoPago?.moneda);
  const { isCalculatingTotal, totalGastadoUSD } = useTotalGastadoUSD(pagosServicio);

  const pagosOrdenados = useMemo(
    () => sortPagosServicioByNewest(pagosServicio),
    [pagosServicio],
  );

  const {
    deleteRenovacionDialogOpen,
    editarPagoDialogOpen,
    handleConfirmDeleteRenovacion,
    handleConfirmEditarPago,
    handleConfirmRenovacion,
    handleDeleteRenovacion,
    handleEditarPago,
    handleRenovar,
    pagoToDelete,
    pagoToEdit,
    renovarDialogOpen,
    setDeleteRenovacionDialogOpen,
    setEditarPagoDialogOpen,
    setPagoToDelete,
    setPagoToEdit,
    setRenovarDialogOpen,
  } = useServicioPaymentActions({
    deleteNotificacionesPorServicio,
    id,
    metodoPago,
    metodosPago,
    pagosOrdenados,
    pagosServicio,
    queryClient,
    refreshPagos,
    renovaciones,
    servicio,
    setServicio,
  });

  const {
    expandedProfileNumber,
    perfilesDisponibles,
    profilePage,
    profilePageCount,
    profileSearch,
    showProfileControls,
    visiblePerfiles,
    goToNextProfilePage,
    goToPreviousProfilePage,
    handleProfileSearchChange,
    toggleProfile,
  } = useServicioProfiles(servicio, ventasServicio);

  // Estado de carga
  if (isLoadingData) {
    return <ServicioLoadingState />;
  }

  if (!servicio) {
    return <ServicioNotFoundState />;
  }

  const returnToServicios = getReturnToServicios({ from, servicio });

  const handleDeleteDialogOpenChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeletePayments(false);
  };

  const handleDeleteRenovacionDialogOpenChange = (open: boolean) => {
    setDeleteRenovacionDialogOpen(open);
    if (!open) setPagoToDelete(null);
  };

  const handleEditarPagoDialogOpenChange = (open: boolean) => {
    setEditarPagoDialogOpen(open);
    if (!open) setPagoToEdit(null);
  };

  return (
    <>
      <div className="min-w-0 space-y-5">
        <ServicioDetalleHeader
          categoria={categoria}
          id={id}
          returnToServicios={returnToServicios}
          servicio={servicio}
          onDelete={handleDelete}
          onRenovar={handleRenovar}
        />

        <div className="min-w-0 space-y-4">
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
            <ServicioSummaryCards
              categoria={categoria}
              currencySymbol={currencySymbol}
              getCicloPagoLabel={getCicloPagoLabel}
              metodoPago={metodoPago}
              servicio={servicio}
            />

            <div className="min-w-0 space-y-4">
              <ServicioProfilesSection
                expandedProfileNumber={expandedProfileNumber}
                getCicloPagoLabel={getCicloPagoLabel}
                metodoPagoMoneda={metodoPago?.moneda}
                onCutSale={handleOpenCutVenta}
                onNextPage={goToNextProfilePage}
                onPreviousPage={goToPreviousProfilePage}
                onProfileSearchChange={handleProfileSearchChange}
                onTransferSale={handleOpenTransferVenta}
                onToggleProfile={toggleProfile}
                perfilesDisponibles={perfilesDisponibles}
                profilePage={profilePage}
                profilePageCount={profilePageCount}
                profileSearch={profileSearch}
                servicio={servicio}
                showProfileControls={showProfileControls}
                visiblePerfiles={visiblePerfiles}
              />

              <ServicioPaymentsHistory
                getCicloPagoLabel={getCicloPagoLabel}
                isCalculatingTotal={isCalculatingTotal}
                isLoading={pagosHistorialLoading}
                metodoPago={metodoPago}
                metodosPago={metodosPago}
                onDeleteRenovacion={handleDeleteRenovacion}
                onEditarPago={handleEditarPago}
                pagosOrdenados={pagosOrdenados}
                totalGastadoUSD={totalGastadoUSD}
              />
            </div>
          </div>
        </div>
      </div>

      <ServicioDetalleDialogs
        categoria={categoria}
        deleteDialogOpen={deleteDialogOpen}
        deletePayments={deletePayments}
        deleteRenovacionDialogOpen={deleteRenovacionDialogOpen}
        editarPagoDialogOpen={editarPagoDialogOpen}
        metodosPago={metodosPago}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeleteRenovacion={handleConfirmDeleteRenovacion}
        onConfirmEditarPago={handleConfirmEditarPago}
        onConfirmRenovacion={handleConfirmRenovacion}
        onDeleteDialogOpenChange={handleDeleteDialogOpenChange}
        onDeletePaymentsChange={setDeletePayments}
        onDeleteRenovacionDialogOpenChange={handleDeleteRenovacionDialogOpenChange}
        onEditarPagoDialogOpenChange={handleEditarPagoDialogOpenChange}
        onRenovarDialogOpenChange={setRenovarDialogOpen}
        pagoToDelete={pagoToDelete}
        pagoToEdit={pagoToEdit}
        renovarDialogOpen={renovarDialogOpen}
        servicio={servicio}
      />

      <CutVentaDialog
        key={selectedActionVenta ? `cut-${selectedActionVenta.id}` : 'cut-empty'}
        isSubmitting={isSaleActionSubmitting}
        open={cutVentaDialogOpen}
        venta={selectedActionVenta}
        onConfirm={handleConfirmCutVenta}
        onOpenChange={(open) => {
          setCutVentaDialogOpen(open);
          if (!open) setSelectedActionVenta(null);
        }}
      />

      <TransferVentaDialog
        key={selectedActionVenta ? `transfer-${selectedActionVenta.id}` : 'transfer-empty'}
        isSubmitting={isSaleActionSubmitting}
        open={transferVentaDialogOpen}
        servicios={servicios}
        venta={selectedActionVenta}
        onConfirm={handleConfirmTransferVenta}
        onOpenChange={(open) => {
          setTransferVentaDialogOpen(open);
          if (!open) setSelectedActionVenta(null);
        }}
      />
    </>
  );
}

export default function ServicioDetalleClient({ id, from }: { id: string; from: string | null }) {
  return (
    <ModuleErrorBoundary moduleName="Detalle de Servicio">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
        <ServicioDetallePageBody id={id} from={from} />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
