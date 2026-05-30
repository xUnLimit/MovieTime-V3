'use client';

import { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useMetodosPagoServicios } from '@/hooks/use-metodos-pago-servicios';
import { usePagosServicio } from '@/hooks/use-pagos-servicio';
import { useServicios } from '@/hooks/use-servicios';
import { useTemplates } from '@/hooks/use-templates';
import { getCurrencySymbol } from '@/platform/constants';

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
import { useServicioDeleteAction } from './components/useServicioDeleteAction';
import { useServicioDetalleData } from './components/useServicioDetalleData';
import { useServicioPaymentActions } from './components/useServicioPaymentActions';
import { useServicioProfiles } from './components/useServicioProfiles';
import { useServicioSaleActions } from './components/useServicioSaleActions';
import { useTotalGastadoUSD } from './components/useTotalGastadoUSD';
import { useServicioDetalleStoreDependencies } from './components/servicio-detalle-store-dependencies';
import {
  getCicloPagoLabel,
  getReturnToServicios,
  sortPagosServicioByNewest,
} from './servicio-detalle-helpers';
import type { TemplateMensaje } from '@/types';

function ServicioDetallePageBody({ id, from }: { id: string; from: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    deleteNotificacionesPorVenta,
    deleteNotificacionesPorServicio,
    deleteServicio,
    enqueueWhatsAppMessages,
    fetchCounts,
    fetchServicios,
    updatePerfilOcupado,
  } = useServicioDetalleStoreDependencies();

  const { data: servicios = [], refetch: refetchServicios } = useServicios();
  const { data: templates = [], refetch: refetchTemplates } = useTemplates();
  const getTemplateByTipo = useMemo(
    () => (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );

  const {
    categoria,
    isLoadingData,
    metodoPago,
    servicio,
    setServicio,
    setVentasServicio,
    ventasServicio,
  } = useServicioDetalleData(id);

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
    deleteNotificacionesPorVenta,
    refetchServicios,
    refetchTemplates,
    getTemplateByTipo,
    queryClient,
    setVentasServicio,
    updatePerfilOcupado,
  });

  const {
    deleteDialogOpen,
    deletePayments,
    handleConfirmDelete,
    handleDelete,
    handleDeleteDialogOpenChange,
    setDeletePayments,
  } = useServicioDeleteAction({
    id,
    deleteServicio,
    fetchCounts,
    queryClient,
    onDeleted: () => router.push('/servicios'),
  });

  const { pagos: pagosServicio, isLoading: pagosHistorialLoading, renovaciones, refresh: refreshPagos } = usePagosServicio(id);
  const { data: metodosPago = [] } = useMetodosPagoServicios();

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
