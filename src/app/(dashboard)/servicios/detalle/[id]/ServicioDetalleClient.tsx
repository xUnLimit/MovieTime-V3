'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useMetodosPagoServicios } from '@/hooks/use-metodos-pago-servicios';
import { usePagosServicio } from '@/hooks/use-pagos-servicio';
import { invalidateDashboardCache, refreshCategoriasCache } from '@/lib/commands/client-cache';
import { getCurrencySymbol } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { getMetodoPagoUseCase } from '@/lib/use-cases/catalogos-use-cases';
import {
  deleteServicioPagoUseCase,
  getServicioUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from '@/lib/use-cases/servicios-use-cases';
import {
  fetchVentasByFiltersUseCase,
  getVentaUseCase,
  updateVentaUseCase,
} from '@/lib/use-cases/ventas-use-cases';
import { buildServiceTransferMessage } from '@/lib/utils/credentialNotification';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useTercerosStore } from '@/store/tercerosStore';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';
import type { MetodoPago, PagoServicio, Servicio, VentaDoc } from '@/types';

import { ServicioDetalleDialogs } from './components/ServicioDetalleDialogs';
import { ServicioDetalleHeader } from './components/ServicioDetalleHeader';
import { ServicioLoadingState, ServicioNotFoundState } from './components/ServicioDetalleStates';
import { ServicioPaymentsHistory } from './components/ServicioPaymentsHistory';
import { ServicioProfilesSection } from './components/ServicioProfilesSection';
import {
  CutVentaDialog,
  TransferVentaDialog,
  type TransferSalePayload,
} from './components/ServicioSaleActionsDialogs';
import { ServicioSummaryCards } from './components/ServicioSummaryCards';
import type { CategoriaDetalle, MetodoPagoDetalle, PagoFormData, PerfilVenta } from './components/types';
import { useServicioProfiles } from './components/useServicioProfiles';
import { useTotalGastadoUSD } from './components/useTotalGastadoUSD';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

function toPerfilVenta(venta: VentaDoc): PerfilVenta & { perfilNumero?: number | null } {
  return {
    ventaId: venta.id || undefined,
    clienteId: venta.clienteId || undefined,
    perfilNumero: venta.perfilNumero ?? null,
    clienteNombre: venta.clienteNombre || undefined,
    clienteTelefono: venta.clienteTelefono || undefined,
    createdAt: venta.createdAt,
    precioFinal: venta.precioFinal ?? venta.precio ?? 0,
    descuento: venta.descuento ?? 0,
    fechaInicio: venta.fechaInicio ?? undefined,
    fechaFin: venta.fechaFin ?? undefined,
    notas: venta.notas || '',
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo || '',
    moneda: venta.moneda || undefined,
    perfilNombre: venta.perfilNombre || undefined,
    codigo: venta.codigo || undefined,
    cicloPago: venta.cicloPago || undefined,
  };
}

async function fetchServicioVentasProfiles(id: string) {
  const ventasBase = await fetchVentasByFiltersUseCase<VentaDoc>([
    { field: 'servicioId', operator: '==', value: id },
  ]);

  return ventasBase
    .filter((venta) => (venta.estado ?? 'activo') !== 'inactivo')
    .map(toPerfilVenta);
}

async function fetchServicioDetalleBundle(id: string): Promise<{
  categoria: CategoriaDetalle;
  metodoPago: MetodoPagoDetalle | null;
  servicio: Servicio;
}> {
  const servicio = await getServicioUseCase<Servicio>(id);
  if (!servicio) {
    throw new Error('Servicio no encontrado');
  }

  const metodoPagoReal = servicio.metodoPagoId
    ? await getMetodoPagoUseCase<MetodoPago>(servicio.metodoPagoId).catch(() => null)
    : null;

  return {
    servicio,
    categoria: {
      id: servicio.categoriaId,
      nombre: servicio.categoriaNombre,
    },
    metodoPago: servicio.metodoPagoId
      ? {
          id: servicio.metodoPagoId,
          nombre: metodoPagoReal?.nombre || servicio.metodoPagoNombre || '',
          moneda: metodoPagoReal?.moneda || servicio.moneda || 'USD',
          alias: metodoPagoReal?.alias,
          numeroTarjeta: metodoPagoReal?.numeroTarjeta,
        }
      : null,
  };
}

function ServicioDetallePageBody({ id, from }: { id: string; from: string | null }) {
  const router = useRouter();
  const { deleteServicio, fetchCounts, fetchServicios, servicios, updatePerfilOcupado } = useServiciosStore();
  const { fetchCategorias } = useCategoriasStore();
  const {
    deleteNotificacionesPorServicio,
    deleteNotificacionesPorVenta,
    fetchNotificaciones,
  } = useNotificacionesStore();
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
  const [deleteRenovacionDialogOpen, setDeleteRenovacionDialogOpen] = useState(false);
  const [cutVentaDialogOpen, setCutVentaDialogOpen] = useState(false);
  const [isSaleActionSubmitting, setIsSaleActionSubmitting] = useState(false);
  const [pagoToDelete, setPagoToDelete] = useState<PagoServicio | null>(null);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<PagoServicio | null>(null);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [selectedActionVenta, setSelectedActionVenta] = useState<VentaDoc | null>(null);
  const [transferVentaDialogOpen, setTransferVentaDialogOpen] = useState(false);
  const [ventasServicio, setVentasServicio] = useState<Array<PerfilVenta & { perfilNumero?: number | null }>>([]);

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
        fetchCategorias(true),
        fetchCounts(true),
      ]);

      router.push('/servicios');
    } catch (error) {
      toast.error('Error al eliminar servicio', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleRenovar = () => {
    setRenovarDialogOpen(true);
  };

  const loadVentaForAction = async (ventaId: string) => {
    const venta = await getVentaUseCase<VentaDoc>(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    setSelectedActionVenta(venta);
    return venta;
  };

  const handleOpenCutVenta = async (ventaId: string) => {
    try {
      await loadVentaForAction(ventaId);
      setCutVentaDialogOpen(true);
    } catch (error) {
      toast.error('No se pudo cargar la venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleOpenTransferVenta = async (ventaId: string) => {
    try {
      await Promise.all([fetchServicios(true), fetchTemplates(true)]);
      await loadVentaForAction(ventaId);
      setTransferVentaDialogOpen(true);
    } catch (error) {
      toast.error('No se pudo preparar la transferencia', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmCutVenta = async (motivoCorte: string) => {
    if (!selectedActionVenta?.id) return;
    setIsSaleActionSubmitting(true);
    try {
      const { serviceProfileDelta } = await updateVentaUseCase(
        selectedActionVenta.id,
        {
          estado: 'inactivo',
          cortadaAt: new Date(),
          motivoCorte,
        },
        {
          currentVenta: selectedActionVenta,
          logContext: getLogContext(),
          recordActivityLog: useActivityLogStore.getState().addLog,
        },
      );

      if (serviceProfileDelta) {
        await updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
      }

      setVentasServicio((current) =>
        current.filter((venta) => venta.ventaId !== selectedActionVenta.id),
      );
      invalidateDashboardCache({ entity: 'venta', entityId: selectedActionVenta.id });
      await deleteNotificacionesPorVenta(selectedActionVenta.id);
      fetchNotificaciones(true);
      setCutVentaDialogOpen(false);
      setSelectedActionVenta(null);
      toast.success('Venta cortada', {
        description: 'La venta quedo inactiva y el perfil fue liberado.',
      });
    } catch (error) {
      toast.error('Error al cortar la venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaleActionSubmitting(false);
    }
  };

  const handleConfirmTransferVenta = async ({
    codigo,
    notificarWhatsApp,
    perfilNombre,
    perfilNumero,
    servicio: targetServicio,
  }: TransferSalePayload) => {
    if (!selectedActionVenta?.id) return;
    setIsSaleActionSubmitting(true);
    try {
      const updatedVentaForMessage: VentaDoc = {
        ...selectedActionVenta,
        servicioId: targetServicio.id,
        servicioNombre: targetServicio.nombre,
        servicioCorreo: targetServicio.correo,
        perfilNumero,
        perfilNombre,
        codigo,
      };

      await updateVentaUseCase(
        selectedActionVenta.id,
        {
          servicioId: targetServicio.id,
          perfilNumero,
          perfilNombre,
          codigo,
        },
        {
          currentVenta: selectedActionVenta,
          logContext: getLogContext(),
          recordActivityLog: useActivityLogStore.getState().addLog,
        },
      );

      if ((selectedActionVenta.estado ?? 'activo') !== 'inactivo') {
        await Promise.all([
          updatePerfilOcupado(selectedActionVenta.servicioId, false),
          updatePerfilOcupado(targetServicio.id, true),
        ]);
      }

      if (notificarWhatsApp) {
        await fetchTerceros(true);
        const tercero = selectedActionVenta.clienteId
          ? useTercerosStore.getState().terceros.find((item) => item.id === selectedActionVenta.clienteId)
          : undefined;
        const phone = (selectedActionVenta.clienteTelefono || tercero?.telefono || '').replace(/[^\d+]/g, '');
        const template = getTemplateByTipo('transferencia_servicio');
        const message = buildServiceTransferMessage(
          template?.contenido,
          updatedVentaForMessage,
          targetServicio,
        );

        enqueueWhatsAppMessages([
          {
            phone,
            message,
            title: phone ? 'Transferencia lista para enviar' : 'Transferencia sin telefono',
            description: phone
              ? `${selectedActionVenta.clienteNombre} recibira las credenciales de ${targetServicio.nombre}.`
              : `${selectedActionVenta.clienteNombre} no tiene telefono registrado. Puedes copiar el mensaje.`,
          },
        ]);
      }

      setVentasServicio((current) =>
        current.filter((venta) => venta.ventaId !== selectedActionVenta.id),
      );
      invalidateDashboardCache({ entity: 'venta', entityId: selectedActionVenta.id });
      fetchNotificaciones(true);
      setTransferVentaDialogOpen(false);
      setSelectedActionVenta(null);
      toast.success('Venta transferida', {
        description: notificarWhatsApp
          ? 'La venta fue movida y el WhatsApp quedo preparado.'
          : 'La venta fue movida al nuevo servicio.',
      });
    } catch (error) {
      toast.error('Error al transferir la venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaleActionSubmitting(false);
    }
  };

  const handleDeleteRenovacion = (pago: PagoServicio) => {
    setPagoToDelete(pago);
    setDeleteRenovacionDialogOpen(true);
  };

  const handleEditarPago = (pago: PagoServicio) => {
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: PagoFormData) => {
    if (!pagoToEdit || !servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const esUltimoPago = pagosOrdenados[0]?.id === pagoToEdit.id;
      const { servicioActualizado } = await updateServicioPagoUseCase(servicio, pagoToEdit, data, {
        metodoPago: metodoPagoSeleccionado,
        isLatestPayment: esUltimoPago,
      });

      if (servicioActualizado) setServicio(servicioActualizado);

      refreshPagos();
      toast.success('Pago actualizado', { description: 'Los datos del pago han sido actualizados correctamente.' });
      setPagoToEdit(null);
      setEditarPagoDialogOpen(false);
    } catch (error) {
      console.error('Error al actualizar pago:', error);
      toast.error('Error al actualizar pago', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleConfirmDeleteRenovacion = async () => {
    if (!pagoToDelete || !servicio) return;
    const eraUltimaRenovacion = pagosOrdenados[0]?.id === pagoToDelete.id;

    try {
      const pagosActualizados = pagosServicio.filter(p => p.id !== pagoToDelete.id);
      const { servicioActualizado } = await deleteServicioPagoUseCase(servicio, pagoToDelete, pagosActualizados, {
        isLatestPayment: eraUltimaRenovacion,
        fallbackMoneda: metodoPago?.moneda,
      });
      invalidateDashboardCache({
        entity: 'servicio',
        entityId: id,
      });
      refreshCategoriasCache({
        entity: 'servicio',
        entityId: id,
      });
      await fetchCategorias(true);
      await refreshPagos();
      if (eraUltimaRenovacion) {
        if (servicioActualizado) setServicio(servicioActualizado);
      }
      toast.success('Renovación eliminada', { description: 'El registro de pago ha sido eliminado del historial.' });
      setPagoToDelete(null);
      setDeleteRenovacionDialogOpen(false);
    } catch (error) {
      console.error('Error al eliminar renovación:', error);
      toast.error('Error al eliminar renovación', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleConfirmRenovacion = async (data: PagoFormData) => {
    if (!servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const { servicioActualizado } = await renewServicioUseCase(servicio, data, {
        numeroRenovacion: renovaciones + 1,
        metodoPago: metodoPagoSeleccionado,
      });

      // Invalidate dashboard cache so it re-fetches on next visit
      invalidateDashboardCache({
        entity: 'servicio',
        entityId: id,
      });

      setServicio(servicioActualizado);

      refreshPagos();

      // Remove notification and refresh store
      await deleteNotificacionesPorServicio(id);
      fetchNotificaciones(true);
      // Refresh categorias so Servicios module reflects updated gastosTotal
      refreshCategoriasCache({
        entity: 'servicio',
        entityId: id,
      });

      toast.success('Renovación registrada', { description: 'El nuevo período de pago se ha registrado correctamente.' });
      setRenovarDialogOpen(false);
    } catch (error) {
      console.error('Error al registrar la renovación:', error);
      toast.error('Error al registrar la renovación', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const getCicloPagoLabel = (ciclo: string) => {
    const labels: Record<string, string> = {
      mensual: 'Mensual',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
    };
    return labels[ciclo] || ciclo;
  };

  const currencySymbol = getCurrencySymbol(metodoPago?.moneda);
  const { isCalculatingTotal, totalGastadoUSD } = useTotalGastadoUSD(pagosServicio);

  const pagosOrdenados = useMemo(() => {
    return [...pagosServicio].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pagosServicio]);

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

  const returnToServicios = (() => {
    if (from && from.startsWith('/servicios/')) return from;
    if (servicio?.categoriaId) return `/servicios/${servicio.categoriaId}`;
    return '/servicios';
  })();

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
