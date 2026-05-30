import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/platform/query-keys';
import {
  fetchServicioDetalleBundleUseCase,
  fetchServicioVentasProfilesUseCase,
} from '@/lib/use-cases/servicios/servicio-detail-use-cases';
import type { Servicio } from '@/types';

import type { CategoriaDetalle, MetodoPagoDetalle, PerfilVenta } from './types';

type ServicioDetalleData = {
  categoria: CategoriaDetalle | null;
  isLoadingData: boolean;
  metodoPago: MetodoPagoDetalle | null;
  servicio: Servicio | null;
  setServicio: Dispatch<SetStateAction<Servicio | null>>;
  setVentasServicio: Dispatch<SetStateAction<Array<PerfilVenta & { perfilNumero?: number | null }>>>;
  ventasServicio: Array<PerfilVenta & { perfilNumero?: number | null }>;
};

export function useServicioDetalleData(id: string): ServicioDetalleData {
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDetalle | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoDetalle | null>(null);
  const [ventasServicio, setVentasServicio] = useState<
    Array<PerfilVenta & { perfilNumero?: number | null }>
  >([]);

  const {
    data: servicioDetalleBundle,
    error: servicioDetalleError,
    isError: isServicioDetalleError,
    isLoading: isLoadingData,
  } = useQuery({
    queryKey: queryKeys.servicios.detailBundle(id),
    queryFn: () => fetchServicioDetalleBundleUseCase(id),
    enabled: Boolean(id),
  });
  const {
    data: ventasServicioQueryData = [],
    error: ventasServicioError,
    isError: isVentasServicioError,
  } = useQuery({
    queryKey: queryKeys.servicios.ventas(id),
    queryFn: () => fetchServicioVentasProfilesUseCase(id),
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
      description: 'Ocurrio un problema al obtener los datos. Intenta nuevamente.',
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
