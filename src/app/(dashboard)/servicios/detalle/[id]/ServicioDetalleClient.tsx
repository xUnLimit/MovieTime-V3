'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { usePagosServicio } from '@/hooks/use-pagos-servicio';
import { invalidateDashboardCache, refreshCategoriasCache } from '@/lib/commands/client-cache';
import { getCurrencySymbol } from '@/lib/constants';
import { getVentasConUltimoPago } from '@/lib/services/ventaSyncService';
import { fetchMetodosPagoByFiltersUseCase } from '@/lib/use-cases/catalogos-use-cases';
import {
  deleteServicioPagoUseCase,
  getServicioUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from '@/lib/use-cases/servicios-use-cases';
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas-use-cases';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import type { MetodoPago, PagoServicio, Servicio, VentaDoc } from '@/types';

import { ServicioDetalleDialogs } from './components/ServicioDetalleDialogs';
import { ServicioDetalleHeader } from './components/ServicioDetalleHeader';
import { ServicioLoadingState, ServicioNotFoundState } from './components/ServicioDetalleStates';
import { ServicioPaymentsHistory } from './components/ServicioPaymentsHistory';
import { ServicioProfilesSection } from './components/ServicioProfilesSection';
import { ServicioSummaryCards } from './components/ServicioSummaryCards';
import type { CategoriaDetalle, MetodoPagoDetalle, PagoFormData, PerfilVenta } from './components/types';
import { useServicioProfiles } from './components/useServicioProfiles';
import { useTotalGastadoUSD } from './components/useTotalGastadoUSD';

function ServicioDetallePageBody({ id, from }: { id: string; from: string | null }) {
  const router = useRouter();
  const { deleteServicio, fetchCounts } = useServiciosStore();
  const { fetchCategorias } = useCategoriasStore();
  const { deleteNotificacionesPorServicio, fetchNotificaciones } = useNotificacionesStore();

  // Estados locales para los datos específicos de esta página
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDetalle | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoDetalle | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);
  const [deleteRenovacionDialogOpen, setDeleteRenovacionDialogOpen] = useState(false);
  const [pagoToDelete, setPagoToDelete] = useState<PagoServicio | null>(null);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<PagoServicio | null>(null);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [ventasServicio, setVentasServicio] = useState<Array<PerfilVenta & { perfilNumero?: number | null }>>([]);

  // Usar el hook para cargar pagos (con cache)
  const { pagos: pagosServicio, isLoading: pagosHistorialLoading, renovaciones, refresh: refreshPagos } = usePagosServicio(id);

  // Cargar solo el servicio (1 lectura única)
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setIsLoadingData(true);
      try {
        // 1. Cargar el servicio (categoriaNombre ya está denormalizado)
        const servicioData = await getServicioUseCase<Servicio>(id);
        if (!servicioData) {
          toast.error('Servicio no encontrado', { description: 'No se encontró el servicio con el ID proporcionado.' });
          setServicio(null);
          return;
        }
        setServicio(servicioData);

        // 2. Crear objeto de categoría sintético desde datos denormalizados
        setCategoria({
          id: servicioData.categoriaId,
          nombre: servicioData.categoriaNombre,
        });

        // 3. Crear objeto sintético de metodoPago desde datos denormalizados
        if (servicioData.metodoPagoId) {
          setMetodoPago({
            id: servicioData.metodoPagoId,
            nombre: servicioData.metodoPagoNombre || '',
            moneda: servicioData.moneda || 'USD',
          });
        }

        // Nota: metodosPago (para dropdown) se carga en lazy load al abrir diálogo de renovación
      } catch (error) {
        console.error('Error cargando datos del servicio:', error);
        toast.error('Error al cargar el servicio', { description: 'Ocurrió un problema al obtener los datos. Intenta nuevamente.' });
        setServicio(null);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    const loadVentas = async () => {
      if (!id) return;
      try {
        // Fase 1: Cargar ventas base inmediatamente (clienteNombre ya está denormalizado en VentaDoc)
        const ventasBase = await fetchVentasByFiltersUseCase<VentaDoc>([
          { field: 'servicioId', operator: '==', value: id },
        ]);

        const ventasActivas = ventasBase.filter((v) => (v.estado ?? 'activo') !== 'inactivo');

        // Mostrar perfiles de inmediato con los datos básicos de VentaDoc
        setVentasServicio(ventasActivas.map((venta) => ({
          ventaId: venta.id || undefined,
          perfilNumero: venta.perfilNumero ?? null,
          clienteNombre: venta.clienteNombre || undefined,
          createdAt: venta.createdAt,
          precioFinal: 0,
          descuento: 0,
          fechaInicio: venta.fechaInicio ?? undefined,
          fechaFin: venta.fechaFin ?? undefined,
          notas: venta.notas || '',
          servicioNombre: venta.servicioNombre,
          servicioCorreo: venta.servicioCorreo || '',
          moneda: venta.moneda || undefined,
          perfilNombre: venta.perfilNombre || undefined,
          codigo: venta.codigo || undefined,
          cicloPago: venta.cicloPago || undefined,
        })));

        // Fase 2: Enriquecer con datos de pagos en background (precio, fechas actualizadas)
        getVentasConUltimoPago(ventasActivas).then((ventasConDatos) => {
          setVentasServicio(ventasConDatos.map((venta) => ({
            ventaId: venta.id || undefined,
            perfilNumero: venta.perfilNumero ?? null,
            clienteNombre: venta.clienteNombre || undefined,
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
          })));
        }).catch(() => {/* datos básicos ya están visibles, ignorar error de enriquecimiento */});

      } catch (error) {
        console.error('Error cargando ventas del servicio:', error);
        toast.error('Error cargando ventas del servicio', { description: error instanceof Error ? error.message : undefined });
        setVentasServicio([]);
      }
    };

    loadVentas();
  }, [id]);

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

  // Lazy load de métodos de pago (solo cuando se necesita renovar)
  const loadMetodosPagoIfNeeded = async () => {
    if (metodosPago.length > 0) return; // Ya están cargados
    try {
      const methods = await fetchMetodosPagoByFiltersUseCase<MetodoPago>([
        { field: 'asociadoA', operator: '==', value: 'servicio' }
      ]);
      setMetodosPago(methods);
    } catch (error) {
      console.error('Error cargando métodos de pago:', error);
      setMetodosPago([]);
    }
  };

  const handleRenovar = async () => {
    await loadMetodosPagoIfNeeded();
    setRenovarDialogOpen(true);
  };

  const handleDeleteRenovacion = (pago: PagoServicio) => {
    setPagoToDelete(pago);
    setDeleteRenovacionDialogOpen(true);
  };

  const handleEditarPago = async (pago: PagoServicio) => {
    await loadMetodosPagoIfNeeded();
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
      refreshPagos();
      if (eraUltimaRenovacion) {
        if (servicioActualizado) setServicio(servicioActualizado);
      }
      toast.success('Renovación eliminada', { description: 'El registro de pago ha sido eliminado del historial.' });
      setPagoToDelete(null);
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
      <div className="space-y-5">
        <ServicioDetalleHeader
          categoria={categoria}
          id={id}
          returnToServicios={returnToServicios}
          servicio={servicio}
          onDelete={handleDelete}
          onRenovar={handleRenovar}
        />

        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
            <ServicioSummaryCards
              categoria={categoria}
              currencySymbol={currencySymbol}
              getCicloPagoLabel={getCicloPagoLabel}
              metodoPago={metodoPago}
              servicio={servicio}
            />

            <div className="space-y-4">
              <ServicioProfilesSection
                expandedProfileNumber={expandedProfileNumber}
                getCicloPagoLabel={getCicloPagoLabel}
                metodoPagoMoneda={metodoPago?.moneda}
                onNextPage={goToNextProfilePage}
                onPreviousPage={goToPreviousProfilePage}
                onProfileSearchChange={handleProfileSearchChange}
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
