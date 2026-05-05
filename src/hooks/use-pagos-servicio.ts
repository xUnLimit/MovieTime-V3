import { useEffect, useState } from 'react';
import { obtenerPagosDeServicio, contarRenovacionesDeServicio } from '@/lib/services/pagosServicioService';
import { PagoServicio } from '@/types';

/**
 * Hook para cargar pagos de un servicio desde la colección pagosServicio
 * Con cache de 5 minutos a nivel de módulo
 */

// Cache a nivel de módulo (compartido entre todas las instancias del hook)
const pagosCache = new Map<string, { data: PagoServicio[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function usePagosServicio(servicioId: string | null) {
  const [pagos, setPagos] = useState<PagoServicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renovaciones, setRenovaciones] = useState(0);

  const loadPagos = async (force = false) => {
    if (!servicioId) {
      setPagos([]);
      setIsLoading(false);
      return;
    }

    // Verificar cache
    if (!force) {
      const cached = pagosCache.get(servicioId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setPagos(cached.data);
        setRenovaciones(cached.data.filter(p => !p.isPagoInicial && p.descripcion !== 'Pago inicial').length);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      const data = await obtenerPagosDeServicio(servicioId);
      const renovacionesCount = await contarRenovacionesDeServicio(servicioId);

      // Guardar en cache
      pagosCache.set(servicioId, { data, timestamp: Date.now() });

      setPagos(data);
      setRenovaciones(renovacionesCount);
    } catch (error) {
      console.error('[usePagosServicio] Error loading pagos:', error);
      setPagos([]);
      setRenovaciones(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioId]);

  const refresh = () => loadPagos(true);

  return { pagos, isLoading, renovaciones, refresh };
}
