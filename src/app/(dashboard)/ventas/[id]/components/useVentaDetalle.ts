'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';

import { usePagosVenta } from '@/hooks/use-pagos-venta';
import { invalidateDashboardCache, syncVentaPronosticoLocal } from '@/lib/commands/client-cache';
import { CYCLE_MONTHS } from '@/lib/constants';
import { getVentaConUltimoPago } from '@/lib/services/ventaSyncService';
import { fetchMetodosPagoByFiltersUseCase } from '@/lib/use-cases/catalogos-use-cases';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import {
  deleteVentaPagoUseCase,
  getVentaConPagoActualUseCase,
  getVentaUseCase,
  renewVentaUseCase,
  timestampToDate,
  updateVentaPagoUseCase,
} from '@/lib/use-cases/ventas-use-cases';
import { withPendingUserPaymentMethod } from '@/lib/utils/usuarioMetodoPago';
import { generarMensajeVenta } from '@/lib/utils/whatsapp';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useTemplatesStore } from '@/store/templatesStore';
import type { MetodoPago, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

import type { VentaDetalleViewModel, VentaPagoFormData } from './types';

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

export function useVentaDetalle(id: string): VentaDetalleViewModel {
  const router = useRouter();

  const { deleteNotificacionesPorVenta, fetchNotificaciones } = useNotificacionesStore();
  const { getTemplateByTipo, fetchTemplates } = useTemplatesStore();

  const [venta, setVenta] = useState<VentaDoc | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [categoriaPlanes, setCategoriaPlanes] = useState<Plan[]>([]);
  const [servicioContrasena, setServicioContrasena] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [deletePagoDialogOpen, setDeletePagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<VentaPago | null>(null);
  const [pagoToDelete, setPagoToDelete] = useState<VentaPago | null>(null);

  const { pagos: pagosVenta, isLoading: loadingPagos, renovaciones, refresh: refreshPagos } = usePagosVenta(id);

  const loadVenta = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const doc = await getVentaUseCase<Record<string, unknown>>(id);
      if (!doc) {
        setVenta(null);
        setLoading(false);
        return;
      }

      const ventaBase: VentaDoc = {
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
        createdAt: doc.createdAt ? timestampToDate(doc.createdAt) : undefined,
        fechaInicio: (doc.fechaInicio as Date) || new Date(),
        fechaFin: (doc.fechaFin as Date) || new Date(),
        cicloPago: (doc.cicloPago as 'mensual' | 'trimestral' | 'semestral' | 'anual') || 'mensual',
      };

      const ventaConDatos = await getVentaConUltimoPago(ventaBase);
      setVenta(ventaConDatos);

      if (ventaConDatos.servicioId) {
        try {
          const servicioDoc = await getServicioUseCase<Record<string, unknown>>(ventaConDatos.servicioId);
          if (servicioDoc && servicioDoc.contrasena) {
            setServicioContrasena(servicioDoc.contrasena as string);
          }
        } catch (error) {
          console.error('Error cargando contraseña del servicio:', error);
        }
      }
    } catch (error) {
      console.error('Error cargando venta:', error);
      toast.error('Error cargando venta', { description: error instanceof Error ? error.message : undefined });
      setVenta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVenta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { esCortada, estadoBadgeClass, estadoLabel } = getEstadoDetalle(venta);

  const diasRestantes = useMemo(() => {
    if (!venta?.fechaFin) return 0;
    return differenceInCalendarDays(venta.fechaFin, new Date());
  }, [venta?.fechaFin]);

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
          moneda: venta.moneda,
          isPagoInicial: p.isPagoInicial,
          notas: p.notas,
          cicloPago: p.cicloPago,
          metodoPagoId: p.metodoPagoId,
          fechaInicio,
          fechaVencimiento,
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
      },
    ];
  }, [venta, pagosVenta, loadingPagos]);

  const loadMetodosPagoYPlanes = async () => {
    if (metodosPago.length > 0 && categoriaPlanes.length > 0) return;
    try {
      if (metodosPago.length === 0) {
        const methods = await fetchMetodosPagoByFiltersUseCase<MetodoPago>([
          { field: 'asociadoA', operator: '==', value: 'usuario' },
        ]);
        setMetodosPago(Array.isArray(methods) ? withPendingUserPaymentMethod(methods) : withPendingUserPaymentMethod([]));
      }

      if (categoriaPlanes.length === 0 && venta?.categoriaId) {
        const categoriaDoc = await getCategoriaUseCase<Record<string, unknown>>(venta.categoriaId);
        if (categoriaDoc && Array.isArray(categoriaDoc.planes)) {
          setCategoriaPlanes(categoriaDoc.planes as Plan[]);
        }
      }
    } catch (error) {
      console.error('Error cargando métodos de pago y planes:', error);
      setMetodosPago([]);
      setCategoriaPlanes([]);
    }
  };

  const handleOpenRenovar = async () => {
    await Promise.all([loadMetodosPagoYPlanes(), fetchTemplates()]);
    setRenovarDialogOpen(true);
  };

  const handleDelete = async (deletePagos: boolean) => {
    if (!venta) return;
    try {
      const { useVentasStore } = await import('@/store/ventasStore');
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
          description: 'La renovación se guardó, pero no se pudo actualizar el método de pago en usuarios.',
        });
      }

      const ventaPronosticoData = renovacion.pronostico;
      syncVentaPronosticoLocal(id, ventaPronosticoData);
      invalidateDashboardCache({ entity: 'venta', entityId: id });

      if (id) {
        const ventaActualizada = await getVentaConPagoActualUseCase(id);
        if (ventaActualizada) setVenta(ventaActualizada);
      }

      refreshPagos();
      await deleteNotificacionesPorVenta(id);
      fetchNotificaciones(true);
      setRenovarDialogOpen(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('venta-updated'));
      }

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
          } catch {
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
    await loadMetodosPagoYPlanes();
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
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
          description: 'El pago se actualizó, pero no se pudo reflejar el método de pago en usuarios.',
        });
      }

      setEditarPagoDialogOpen(false);
      setPagoToEdit(null);

      if (id) {
        const ventaActualizada = await getVentaConPagoActualUseCase(id);
        if (ventaActualizada) setVenta(ventaActualizada);
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

      if (ventaActualizada) setVenta(ventaActualizada);

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
    handleDelete,
    handleDeletePago,
    handleEditarPago,
    handleOpenRenovar,
    loading,
    loadingPagos,
    metodosPago,
    pagoToEdit,
    paymentRows,
    perfilDisplay,
    renovaciones,
    renovarDialogOpen,
    servicioContrasena,
    setDeleteDialogOpen,
    setDeletePagoDialogOpen,
    setEditarPagoDialogOpen,
    setRenovarDialogOpen,
    venta,
  };
}
