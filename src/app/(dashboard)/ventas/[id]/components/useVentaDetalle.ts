'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';

import { usePagosVenta } from '@/hooks/use-pagos-venta';
import { useTemplates } from '@/hooks/use-templates';
import { reportError } from '@/platform/observability/logger';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';
import {
  buildVentaPaymentRows,
  fetchCategoriaPlanesQuery,
  fetchMetodosPagoTercerosWithPendingQuery,
  fetchVentaDetalleQuery,
  getEstadoDetalle,
  type VentaDetalleQueryData,
} from '@/application/use-cases/ventas/venta-detail-use-cases';
import { calcularMontoSinConsumir, roundToDecimals } from '@/platform/utils/calculations';
import type { TemplateMensaje, VentaDoc } from '@/types';

import type { VentaDetalleViewModel } from './types';
import { useVentaDetalleActions } from './useVentaDetalleActions';
import { useVentaDetalleStoreDependencies } from './venta-detalle-store-dependencies';
import { ensureVentaDialogDependencies } from './venta-dialog-dependencies';

export function useVentaDetalle(id: string): VentaDetalleViewModel {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    deleteNotificacionesPorVenta,
    deleteVenta,
    inactivateServicio,
    updatePerfilOcupado,
  } = useVentaDetalleStoreDependencies();
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );

  const { pagos: pagosVenta, isLoading: loadingPagos, renovaciones, refresh: refreshPagos } = usePagosVenta(id);

  const ventaDetalleQuery = useQuery({
    queryKey: queryKeys.ventas.detail(id || 'invalid'),
    queryFn: () => fetchVentaDetalleQuery(id),
    enabled: Boolean(id),
  });

  const venta = ventaDetalleQuery.data?.venta ?? null;
  const servicioContrasena = ventaDetalleQuery.data?.servicioContrasena ?? '';
  const loading = ventaDetalleQuery.isLoading;
  const shouldLoadDialogDependencies = Boolean(venta);
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

    reportError('VentaDetalle', 'Error cargando venta', ventaDetalleQuery.error);
    toast.error('Error cargando venta', {
      description: getPublicErrorMessage(ventaDetalleQuery.error, 'No se pudo cargar la venta.'),
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
  const paymentRows = useMemo(
    () => buildVentaPaymentRows({ loadingPagos, pagosVenta, venta }),
    [venta, pagosVenta, loadingPagos],
  );

  const ensureDialogDependencies = useCallback(
    () => ensureVentaDialogDependencies({
      categoriaId: venta?.categoriaId,
      queryClient,
    }),
    [queryClient, venta?.categoriaId],
  );

  const {
    deleteDialogOpen,
    deletePagoDialogOpen,
    editarPagoDialogOpen,
    handleConfirmDeletePago,
    handleConfirmEditarPago,
    handleConfirmRenovacion,
    handleConfirmReembolso,
    handleDelete,
    handleDeletePago,
    handleEditarPago,
    handleOpenRenovar,
    handleOpenReembolso,
    pagoToEdit,
    renovarDialogOpen,
    reembolsoDialogOpen,
    setDeleteDialogOpen,
    setDeletePagoDialogOpen,
    setEditarPagoDialogOpen,
    setRenovarDialogOpen,
    setReembolsoDialogOpen,
  } = useVentaDetalleActions({
    deleteNotificacionesPorVenta,
    deleteVenta,
    ensureDialogDependencies,
    getTemplateByTipo,
    id,
    inactivateServicio,
    metodosPago,
    onDeleted: () => router.push('/ventas'),
    queryClient,
    refreshPagos,
    servicioContrasena,
    setVentaData,
    updatePerfilOcupado,
    venta,
  });

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
