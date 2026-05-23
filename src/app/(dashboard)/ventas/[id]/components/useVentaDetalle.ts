'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';

import { usePagosVenta } from '@/hooks/use-pagos-venta';
import { useTemplates } from '@/hooks/use-templates';
import { queryKeys } from '@/lib/query-keys';
import { invalidateDashboardCache, syncVentaPronosticoLocal } from '@/lib/commands/client-cache';
import { CYCLE_MONTHS } from '@/lib/constants';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { getVentaConUltimoPago } from '@/lib/services/ventaSyncService';
import { queryMetodosPago } from '@/lib/supabase/catalogos-repository';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import {
  createVentaRefundUseCase,
  deleteVentaPagoUseCase,
  getVentaConPagoActualUseCase,
  getVentaUseCase,
  renewVentaUseCase,
  timestampToDate,
  updateVentaPagoUseCase,
} from '@/lib/use-cases/ventas-use-cases';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import { generarMensajeVenta } from '@/lib/utils/whatsapp';
import { calcularMontoSinConsumir, roundToDecimals } from '@/lib/utils/calculations';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useVentasStore } from '@/store/ventasStore';
import type { MetodoPago, TemplateMensaje, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

import type { VentaDetalleViewModel, VentaPagoFormData, VentaReembolsoFormData } from './types';

const getEstadoDetalle = (venta: VentaDoc | null) => {
  const esCortada = venta?.estado === 'inactivo' && !!venta?.cortadaAt;
  const estadoLabel = venta?.estado === 'inactivo' ? (esCortada ? 'Cortada' : 'Inactiva') : 'Activa';
  const estadoBadgeClass =
    venta?.estado === 'inactivo'
      ? (esCortada
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-600/20 dark:text-orange-400'
          : 'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400')
      : 'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400';

  return { esCortada, estadoBadgeClass, estadoLabel };
};

function emitVentaUpdated(ventaId: string) {
  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId });
}

interface VentaDetalleQueryData {
  servicioContrasena: string;
  venta: VentaDoc | null;
}

function toVentaDetalleBase(doc: Record<string, unknown>): VentaDoc {
  return {
    id: doc.id as string,
    clienteId: (doc.clienteId as string) || '',
    clienteNombre: (doc.clienteNombre as string) || 'Sin cliente',
    categoriaId: (doc.categoriaId as string) || '',
    categoriaNombre: (doc.categoriaNombre as string) || undefined,
    servicioId: (doc.servicioId as string) || '',
    servicioNombre: (doc.servicioNombre as string) || 'Servicio',
    servicioCorreo: (doc.servicioCorreo as string) || '',
    clienteTelefono: (doc.clienteTelefono as string) || undefined,
    perfilNumero: (doc.perfilNumero as number | null | undefined) ?? null,
    perfilNombre: (doc.perfilNombre as string) || '',
    codigo: (doc.codigo as string) || '',
    notas: (doc.notas as string) || '',
    estado: (doc.estado as VentaDoc['estado']) ?? 'activo',
    cortadaAt: doc.cortadaAt ? new Date(doc.cortadaAt as string) : null,
    motivoCorte: (doc.motivoCorte as string | null | undefined) ?? null,
    createdAt: doc.createdAt ? timestampToDate(doc.createdAt) : undefined,
    fechaInicio: (doc.fechaInicio as Date) || new Date(),
    fechaFin: (doc.fechaFin as Date) || new Date(),
    cicloPago: (doc.cicloPago as 'mensual' | 'trimestral' | 'semestral' | 'anual') || 'mensual',
    planId: (doc.planId as string) || undefined,
    planNombre: (doc.planNombre as string) || undefined,
    planTipoNombre: (doc.planTipoNombre as string) || undefined,
  };
}
async function fetchVentaDetalleQuery(id: string): Promise<VentaDetalleQueryData> {
  if (!id) return { venta: null, servicioContrasena: '' };

  const doc = await getVentaUseCase<Record<string, unknown>>(id);
  if (!doc) return { venta: null, servicioContrasena: '' };

  const ventaConDatos = await getVentaConUltimoPago(toVentaDetalleBase(doc));
  let servicioContrasena = '';

  if (ventaConDatos.servicioId) {
    try {
      const servicioDoc = await getServicioUseCase<Record<string, unknown>>(ventaConDatos.servicioId);
      if (servicioDoc?.contrasena) {
        servicioContrasena = servicioDoc.contrasena as string;
      }
    } catch (error) {
      console.error('Error cargando contrasena del servicio:', error);
    }
  }

  return { venta: ventaConDatos, servicioContrasena };
}

async function fetchMetodosPagoTercerosWithPendingQuery(): Promise<MetodoPago[]> {
  const methods = await queryMetodosPago<MetodoPago>([
    { field: 'asociadoA', operator: '==', value: 'tercero' },
  ]);

  return withPendingTerceroPaymentMethod(Array.isArray(methods) ? methods : []);
}

async function fetchCategoriaPlanesQuery(categoriaId: string): Promise<Plan[]> {
  const categoriaDoc = await getCategoriaUseCase<Record<string, unknown>>(categoriaId);
  return categoriaDoc && Array.isArray(categoriaDoc.planes)
    ? (categoriaDoc.planes as Plan[])
    : [];
}

export function useVentaDetalle(id: string): VentaDetalleViewModel {
  const router = useRouter();
  const queryClient = useQueryClient();

  const deleteNotificacionesPorVenta = useNotificacionesStore((state) => state.deleteNotificacionesPorVenta);
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [reembolsoDialogOpen, setReembolsoDialogOpen] = useState(false);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [deletePagoDialogOpen, setDeletePagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<VentaPago | null>(null);
  const [pagoToDelete, setPagoToDelete] = useState<VentaPago | null>(null);

  const { pagos: pagosVenta, isLoading: loadingPagos, renovaciones, refresh: refreshPagos } = usePagosVenta(id);

  const ventaDetalleQuery = useQuery({
    queryKey: queryKeys.ventas.detail(id || 'invalid'),
    queryFn: () => fetchVentaDetalleQuery(id),
    enabled: Boolean(id),
  });

  const venta = ventaDetalleQuery.data?.venta ?? null;
  const servicioContrasena = ventaDetalleQuery.data?.servicioContrasena ?? '';
  const loading = ventaDetalleQuery.isLoading;
  const shouldLoadDialogDependencies =
    renovarDialogOpen || reembolsoDialogOpen || editarPagoDialogOpen;
  const metodosPagoQuery = useQuery({
    queryKey: queryKeys.metodosPago.tercerosWithPending(),
    queryFn: fetchMetodosPagoTercerosWithPendingQuery,
    enabled: shouldLoadDialogDependencies,
  });
  const categoriaPlanesQuery = useQuery({
    queryKey: queryKeys.categorias.detail(venta?.categoriaId ?? 'invalid'),
    queryFn: () => fetchCategoriaPlanesQuery(venta!.categoriaId),
    enabled: shouldLoadDialogDependencies && Boolean(venta?.categoriaId),
  });
  const metodosPago = metodosPagoQuery.data ?? [];
  const categoriaPlanes = categoriaPlanesQuery.data ?? [];

  const setVentaData = useCallback(
    (nextVenta: VentaDoc | null) => {
      queryClient.setQueryData<VentaDetalleQueryData>(
        queryKeys.ventas.detail(id || 'invalid'),
        (current) => ({
          servicioContrasena: current?.servicioContrasena ?? servicioContrasena,
          venta: nextVenta,
        }),
      );
    },
    [id, queryClient, servicioContrasena],
  );

  useEffect(() => {
    if (!ventaDetalleQuery.error) return;

    console.error('Error cargando venta:', ventaDetalleQuery.error);
    toast.error('Error cargando venta', {
      description:
        ventaDetalleQuery.error instanceof Error ? ventaDetalleQuery.error.message : undefined,
    });
  }, [ventaDetalleQuery.error]);

  const { esCortada, estadoBadgeClass, estadoLabel } = getEstadoDetalle(venta);

  const diasRestantes = venta?.fechaFin
    ? differenceInCalendarDays(venta.fechaFin, new Date())
    : 0;

  const reembolsoMontoSugerido =
    venta?.fechaInicio && venta.fechaFin && venta.precioFinal && venta.estado !== 'inactivo'
      ? roundToDecimals(calcularMontoSinConsumir(
          new Date(venta.fechaInicio),
          new Date(venta.fechaFin),
          venta.precioFinal
        ))
      : 0;

  const perfilDisplay = venta?.perfilNombre?.trim() || '—';

  const paymentRows = useMemo(() => {
    if (!venta || loadingPagos) return [];

    if (pagosVenta.length > 0) {
      return pagosVenta.map((p, index) => {
        let fechaInicio = p.fechaInicio;
        let fechaVencimiento = p.fechaVencimiento;

        if (!fechaInicio || !fechaVencimiento) {
          if (p.isPagoInicial) {
            fechaInicio = venta.fechaInicio ?? p.fecha;
            fechaVencimiento = venta.fechaFin ?? p.fecha;
          } else {
            const pagoAnterior = pagosVenta[index + 1];
            if (pagoAnterior?.fechaVencimiento) {
              fechaInicio = pagoAnterior.fechaVencimiento;
              const mesesCiclo = p.cicloPago ? CYCLE_MONTHS[p.cicloPago as keyof typeof CYCLE_MONTHS] : 1;
              const fechaVenc = new Date(fechaInicio);
              fechaVenc.setMonth(fechaVenc.getMonth() + mesesCiclo);
              fechaVencimiento = fechaVenc;
            } else {
              fechaInicio = p.fecha;
              fechaVencimiento = p.fecha;
            }
          }
        }

        return {
          id: p.id,
          fecha: p.fecha,
          descripcion: p.descripcion ?? (p.isPagoInicial ? 'Pago Inicial' : 'Renovación'),
          precio: p.precio ?? p.monto,
          descuento: p.descuento ?? 0,
          total: p.monto,
          metodoPagoNombre: p.metodoPago,
          destinoReembolso: p.destinoReembolso,
          moneda: p.moneda ?? venta.moneda,
          isPagoInicial: p.isPagoInicial,
          notas: p.notas,
          cicloPago: p.cicloPago,
          metodoPagoId: p.metodoPagoId,
          fechaInicio,
          fechaVencimiento,
          estado: p.estado,
          motivoAnulacion: p.motivoAnulacion,
        } as VentaPago;
      });
    }

    return [
      {
        id: 'synthetic-initial',
        fecha: venta.createdAt || venta.fechaInicio || new Date(),
        descripcion: 'Pago Inicial',
        precio: venta.precio ?? 0,
        descuento: venta.descuento ?? 0,
        total: venta.precioFinal ?? 0,
        metodoPagoId: venta.metodoPagoId ?? null,
        metodoPagoNombre: venta.metodoPagoNombre,
        moneda: venta.moneda,
        isPagoInicial: true,
        estado: 'registrado' as const,
      },
    ];
  }, [venta, pagosVenta, loadingPagos]);

  const ensureDialogDependencies = async () => {
    try {
      await Promise.all([
        queryClient.ensureQueryData({
          queryKey: queryKeys.metodosPago.tercerosWithPending(),
          queryFn: fetchMetodosPagoTercerosWithPendingQuery,
        }),
        venta?.categoriaId
          ? queryClient.ensureQueryData({
              queryKey: queryKeys.categorias.detail(venta.categoriaId),
              queryFn: () => fetchCategoriaPlanesQuery(venta.categoriaId),
            })
          : Promise.resolve([]),
      ]);
    } catch (error) {
      console.error('Error cargando métodos de pago y planes:', error);
    }
  };

  const handleOpenRenovar = async () => {
    await ensureDialogDependencies();
    setRenovarDialogOpen(true);
  };

  const handleOpenReembolso = async () => {
    await ensureDialogDependencies();
    setReembolsoDialogOpen(true);
  };

  const handleDelete = async (deletePagos: boolean) => {
    if (!venta) return;
    try {
      await useVentasStore.getState().deleteVenta(
        venta.id,
        venta.servicioId,
        venta.perfilNumero ?? undefined,
        deletePagos
      );

      if (deletePagos) {
        toast.success('Venta eliminada', { description: 'La venta y todos sus registros de pago han sido eliminados.' });
      } else {
        toast.success('Venta eliminada', { description: 'La venta fue eliminada. Los registros de pago se conservaron.' });
      }
      router.push('/ventas');
    } catch (error) {
      console.error('Error eliminando venta:', error);
      toast.error('Error eliminando venta', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleConfirmRenovacion = async (data: VentaPagoFormData) => {
    if (!venta) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const renovacion = await renewVentaUseCase(venta, {
        ...data,
        metodoPagoNombre: metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
      });

      if (renovacion.syncPaymentMethodFailed) {
        toast.warning('Venta renovada con advertencia', {
          description: 'La renovación se guardó, pero no se pudo actualizar el método de pago en terceros.',
        });
      }

      const ventaPronosticoData = renovacion.pronostico;
      syncVentaPronosticoLocal(id, ventaPronosticoData);
      invalidateDashboardCache({ entity: 'venta', entityId: id });

      if (id) {
        const ventaActualizada = await getVentaConPagoActualUseCase(id);
        if (ventaActualizada) setVentaData(ventaActualizada);
      }

      refreshPagos();
      await deleteNotificacionesPorVenta(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      setRenovarDialogOpen(false);

      emitVentaUpdated(id);

      if (data.notificarWhatsApp && venta) {
        const templateRenovacion = getTemplateByTipo('renovacion');
        if (templateRenovacion) {
          try {
            const clienteSoloNombre = venta.clienteNombre.split(' ')[0];
            const mensaje = generarMensajeVenta(templateRenovacion.contenido, {
              clienteNombre: venta.clienteNombre,
              clienteSoloNombre,
              servicioNombre: venta.servicioNombre,
              categoriaNombre: venta.categoriaNombre || '',
              perfilNombre: venta.perfilNombre || '',
              correo: venta.servicioCorreo || '',
              contrasena: venta.servicioContrasena || servicioContrasena || '',
              codigo: venta.codigo || '',
              fechaVencimiento: data.fechaVencimiento,
              monto: renovacion.monto,
            });
            const phone = venta.clienteTelefono
              ? venta.clienteTelefono.replace(/[^\d+]/g, '')
              : '';
            toast.success('Venta renovada exitosamente', {
              duration: Infinity,
              action: {
                label: 'Enviar WhatsApp',
                onClick: () => {
                  const base = phone
                    ? `https://web.whatsapp.com/send?phone=${phone}&text=`
                    : `https://web.whatsapp.com/send?text=`;
                  window.open(base + encodeURIComponent(mensaje), '_blank', 'noopener,noreferrer');
                },
              },
              actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
            });
          } catch (error) {
            void error;
            toast.success('Venta renovada exitosamente');
          }
        } else {
          toast.success('Venta renovada exitosamente');
        }
      } else {
        toast.success('Venta renovada exitosamente');
      }
    } catch (error) {
      console.error('Error renovando venta:', error);
      toast.error('Error al renovar venta');
    }
  };

  const handleEditarPago = async (pago: VentaPago) => {
    await ensureDialogDependencies();
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
  };

  const handleConfirmReembolso = async (data: VentaReembolsoFormData) => {
    if (!venta) return;
    try {
      const result = await createVentaRefundUseCase(
        venta,
        {
          ventaId: venta.id,
          monto: data.monto,
          metodoPagoId: data.metodoPagoId,
          metodoPagoNombre: data.metodoPagoNombre,
          destinoReembolso: data.destinoReembolso,
          moneda: data.moneda,
          fecha: data.fecha,
          nota: data.nota,
          cortarServicio: data.cortarServicio,
          motivoCorte: data.motivoCorte,
        },
        {
          logContext: getStoreLogContext(),
          recordActivityLog: useActivityLogStore.getState().addLog,
        }
      );

      if (result.serviceProfileDelta) {
        await useServiciosStore
          .getState()
          .updatePerfilOcupado(result.serviceProfileDelta.servicioId, result.serviceProfileDelta.shouldIncrement);
      }

      if (result.ventaActualizada) setVentaData(result.ventaActualizada);
      refreshPagos();
      syncVentaPronosticoLocal(id, result.pronostico);
      invalidateDashboardCache({ entity: 'venta', entityId: id });

      if (data.cortarServicio) {
        await deleteNotificacionesPorVenta(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      }

      setReembolsoDialogOpen(false);

      emitVentaUpdated(id);

      toast.success(data.cortarServicio ? 'Venta reembolsada y cortada' : 'Reembolso registrado');
    } catch (error) {
      console.error('Error registrando reembolso:', error);
      toast.error('Error al registrar reembolso', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleDeletePago = (pago: VentaPago) => {
    setPagoToDelete(pago);
    setDeletePagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: VentaPagoFormData) => {
    if (!venta || !pagoToEdit || !pagoToEdit.id) {
      console.error('[EditarPago] Missing data:', { venta: !!venta, pagoToEdit: !!pagoToEdit, id: pagoToEdit?.id });
      return;
    }

    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const updateResult = await updateVentaPagoUseCase(venta, pagoToEdit.id, {
        ...data,
        metodoPagoNombre: data.metodoPagoNombre || metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
      });

      if (updateResult.syncPaymentMethodFailed) {
        toast.warning('Pago actualizado con advertencia', {
          description: 'El pago se actualizó, pero no se pudo reflejar el método de pago en terceros.',
        });
      }

      setEditarPagoDialogOpen(false);
      setPagoToEdit(null);

      if (id) {
        const ventaActualizada = await getVentaConPagoActualUseCase(id);
        if (ventaActualizada) setVentaData(ventaActualizada);
      }

      refreshPagos();
      toast.success('Pago actualizado exitosamente');
    } catch (error) {
      console.error('[EditarPago] Error actualizando pago:', error);
      toast.error('Error al actualizar pago');
    }
  };

  const handleConfirmDeletePago = async () => {
    if (!venta || !pagoToDelete || !pagoToDelete.id) {
      console.error('[DeletePago] Missing data:', { venta: !!venta, pagoToDelete: !!pagoToDelete, id: pagoToDelete?.id });
      return;
    }

    try {
      const { ventaActualizada } = await deleteVentaPagoUseCase(id, pagoToDelete.id);

      setDeletePagoDialogOpen(false);
      setPagoToDelete(null);

      if (ventaActualizada) setVentaData(ventaActualizada);

      refreshPagos();
      toast.success('Pago eliminado exitosamente');
    } catch (error) {
      console.error('[DeletePago] Error eliminando pago:', error);
      toast.error('Error al eliminar pago');
    }
  };

  return {
    categoriaPlanes,
    deleteDialogOpen,
    deletePagoDialogOpen,
    diasRestantes,
    editarPagoDialogOpen,
    esCortada,
    estadoBadgeClass,
    estadoLabel,
    handleConfirmDeletePago,
    handleConfirmEditarPago,
    handleConfirmRenovacion,
    handleConfirmReembolso,
    handleDelete,
    handleDeletePago,
    handleEditarPago,
    handleOpenRenovar,
    handleOpenReembolso,
    loading,
    loadingPagos,
    metodosPago,
    pagoToEdit,
    paymentRows,
    perfilDisplay,
    renovaciones,
    renovarDialogOpen,
    reembolsoDialogOpen,
    reembolsoMontoSugerido,
    servicioContrasena,
    setDeleteDialogOpen,
    setDeletePagoDialogOpen,
    setEditarPagoDialogOpen,
    setRenovarDialogOpen,
    setReembolsoDialogOpen,
    venta,
  };
}
