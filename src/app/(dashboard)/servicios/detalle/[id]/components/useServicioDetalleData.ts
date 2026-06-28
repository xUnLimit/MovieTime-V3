import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { reportError } from '@/platform/observability/logger';
import { queryKeys } from '@/platform/query-keys';
import {
  fetchServicioDetalleBundleUseCase,
  fetchServicioVentasProfilesUseCase,
} from '@/application/use-cases/servicios/servicio-detail-use-cases';
import type { Servicio } from '@/types';

import type { CategoriaDetalle, MetodoPagoDetalle, PerfilVenta } from './types';

type ServicioDetalleBundle = Awaited<ReturnType<typeof fetchServicioDetalleBundleUseCase>>;
type VentasServicioState = Array<PerfilVenta & { perfilNumero?: number | null }>;

const EMPTY_VENTAS_SERVICIO: VentasServicioState = [];

type ServicioDetalleData = {
  categoria: CategoriaDetalle | null;
  isLoadingData: boolean;
  metodoPago: MetodoPagoDetalle | null;
  servicio: Servicio | null;
  setServicio: Dispatch<SetStateAction<Servicio | null>>;
  setVentasServicio: Dispatch<SetStateAction<VentasServicioState>>;
  ventasServicio: VentasServicioState;
};

export function useServicioDetalleData(id: string): ServicioDetalleData {
  const queryClient = useQueryClient();
  const servicioDetalleKey = useMemo(() => queryKeys.servicios.detailBundle(id), [id]);
  const ventasServicioKey = useMemo(() => queryKeys.servicios.ventas(id), [id]);

  const {
    data: servicioDetalleBundle,
    error: servicioDetalleError,
    isError: isServicioDetalleError,
    isLoading: isLoadingData,
  } = useQuery({
    queryKey: servicioDetalleKey,
    queryFn: () => fetchServicioDetalleBundleUseCase(id),
    enabled: Boolean(id),
  });
  const {
    data: ventasServicioQueryData,
    error: ventasServicioError,
    isError: isVentasServicioError,
  } = useQuery({
    queryKey: ventasServicioKey,
    queryFn: () => fetchServicioVentasProfilesUseCase(id),
    enabled: Boolean(id),
  });

  const servicio = servicioDetalleBundle?.servicio ?? null;
  const categoria = servicioDetalleBundle?.categoria ?? null;
  const metodoPago = servicioDetalleBundle?.metodoPago ?? null;
  const ventasServicio = (ventasServicioQueryData ?? EMPTY_VENTAS_SERVICIO) as VentasServicioState;

  const setServicio = useCallback<Dispatch<SetStateAction<Servicio | null>>>(
    (nextServicio) => {
      queryClient.setQueryData<ServicioDetalleBundle | undefined>(
        servicioDetalleKey,
        (currentBundle) => {
          if (!currentBundle) return currentBundle;

          const resolvedServicio =
            typeof nextServicio === 'function'
              ? nextServicio(currentBundle.servicio ?? null)
              : nextServicio;

          if (!resolvedServicio) return undefined;

          return {
            ...currentBundle,
            servicio: resolvedServicio,
          };
        },
      );
    },
    [queryClient, servicioDetalleKey],
  );

  const setVentasServicio = useCallback<Dispatch<SetStateAction<VentasServicioState>>>(
    (nextVentasServicio) => {
      queryClient.setQueryData<VentasServicioState>(ventasServicioKey, (currentVentas) => {
        const baseVentas = currentVentas ?? EMPTY_VENTAS_SERVICIO;
        return typeof nextVentasServicio === 'function'
          ? nextVentasServicio(baseVentas)
          : nextVentasServicio;
      });
    },
    [queryClient, ventasServicioKey],
  );

  useEffect(() => {
    if (!isServicioDetalleError) return;
    reportError('ServicioDetalleData', 'Error cargando datos del servicio', servicioDetalleError);
    toast.error('Error al cargar el servicio', {
      description: 'Ocurrio un problema al obtener los datos. Intenta nuevamente.',
    });
  }, [isServicioDetalleError, servicioDetalleError]);

  useEffect(() => {
    if (!isVentasServicioError) return;
    reportError('ServicioDetalleData', 'Error cargando ventas del servicio', ventasServicioError);
    toast.error('Error cargando ventas del servicio', {
      description: ventasServicioError instanceof Error ? ventasServicioError.message : undefined,
    });
  }, [isVentasServicioError, ventasServicioError]);

  return {
    categoria,
    isLoadingData,
    metodoPago,
    servicio,
    setServicio,
    setVentasServicio,
    ventasServicio,
  };
}
