'use client';

import { useEffect, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { COLLECTIONS, queryDocuments } from '@/lib/firebase/firestore';
import { logVentasCacheHit } from '@/lib/utils/devLogger';
import { getVentasConUltimoPago } from '@/lib/services/ventaSyncService';
import type { VentaDoc } from '@/types';

/**
 * Resultado agregado por usuario: monto sin consumir calculado
 * a partir de sus ventas activas.
 * `serviciosActivos` ya viene denormalizado en el doc del usuario
 * como campo `ventasActivas` — no se calcula aquí.
 */
export interface VentasUsuarioStats {
  montoSinConsumir: number;
}

// Cache a nivel de módulo: persiste entre montajes de componentes.
// Key = idsKey (IDs ordenados y concatenados), Value = { data, ts }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const ventasCache = new Map<string, { data: Record<string, VentasUsuarioStats>; ts: number }>();

/**
 * Invalida el cache de ventas por usuarios.
 * Útil cuando se elimina/actualiza una venta desde otra página.
 */
export function invalidateVentasPorUsuariosCache() {
  ventasCache.clear();
}

/** Query con chunks para evitar el límite de 30 del operador 'in' de Firestore */
async function queryVentasPorClienteIds(clienteIds: string[]): Promise<VentaDoc[]> {
  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < clienteIds.length; i += CHUNK_SIZE) {
    chunks.push(clienteIds.slice(i, i + CHUNK_SIZE));
  }
  const results = await Promise.all(
    chunks.map(chunk =>
      queryDocuments<VentaDoc>(COLLECTIONS.VENTAS, [
        { field: 'clienteId', operator: 'in', value: chunk },
      ])
    )
  );
  return results.flat();
}

/**
 * Revisa si hubo un cambio en ventas (via localStorage) más reciente que el cache.
 * localStorage.setItem NO dispara el evento 'storage' en la misma pestaña,
 * así que debemos checar manualmente al montar.
 */
function shouldInvalidateCache(cachedTs: number): boolean {
  if (typeof window === 'undefined') return false;
  for (const key of ['venta-deleted', 'venta-created', 'venta-updated']) {
    const val = localStorage.getItem(key);
    if (val) {
      const changeTs = parseInt(val, 10);
      if (!isNaN(changeTs) && changeTs > cachedTs) return true;
    }
  }
  return false;
}

/**
 * Carga solo las ventas activas de los usuarios de la página actual
 * usando una query `clienteId in [ids]`.
 * Calcula montoSinConsumir por usuario.
 *
 * @param clienteIds – IDs de los usuarios visibles en la página (máx 10)
 */
export function useVentasPorUsuarios(clienteIds: string[], { enabled = true } = {}) {
  const [stats, setStats] = useState<Record<string, VentasUsuarioStats>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Key estable para evitar re-renders por referencia
  const idsKey = clienteIds.join(',');

  useEffect(() => {
    // No disparar hasta que los datos de la página estén listos
    if (!enabled) return;

    // Sin IDs clientes → no hay nada que consultar
    if (clienteIds.length === 0) {
      setStats({});
      return;
    }

    // Cache hit: mismo set de IDs dentro del TTL
    // PERO invalidar si hubo cambios en ventas después del cache (misma pestaña)
    const cached = ventasCache.get(idsKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (shouldInvalidateCache(cached.ts)) {
        ventasCache.delete(idsKey);
      } else {
        logVentasCacheHit(clienteIds.length, Math.round((Date.now() - cached.ts) / 1000));
        setStats(cached.data);
        return;
      }
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        // Paso 1: Cargar ventas base (solo metadatos) — chunks de 30 para evitar límite 'in'
        const ventasBase = await queryVentasPorClienteIds(clienteIds);

        if (cancelled) return;

        // Paso 2: Cargar datos actuales desde PagoVenta (fuente de verdad)
        const ventasConDatos = await getVentasConUltimoPago(ventasBase);

        if (cancelled) return;

        const now = new Date();
        const result: Record<string, VentasUsuarioStats> = {};

        ventasConDatos.forEach((venta) => {
          const clienteId = venta.clienteId;
          if (!clienteId) return;

          // Solo ventas activas contribuyen al monto
          const isActivo = (venta.estado ?? 'activo') !== 'inactivo';
          if (!isActivo) return;

          const fechaInicio = venta.fechaInicio instanceof Date ? venta.fechaInicio : null;
          const fechaFin    = venta.fechaFin    instanceof Date ? venta.fechaFin    : null;
          const precioFinal = venta.precioFinal ?? venta.precio ?? 0;

          const totalDias     = fechaInicio && fechaFin ? Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0) : 0;
          const diasRestantes = fechaFin ? Math.max(differenceInCalendarDays(fechaFin, now), 0) : 0;
          const ratioRestante = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
          const montoVenta    = totalDias > 0 ? Math.max(precioFinal * ratioRestante, 0) : 0;

          if (!result[clienteId]) {
            result[clienteId] = { montoSinConsumir: 0 };
          }
          result[clienteId].montoSinConsumir += montoVenta;
        });

        ventasCache.set(idsKey, { data: result, ts: Date.now() });
        setStats(result);
      } catch (error) {
        console.error('Error cargando ventas por usuarios:', error);
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled]);

  // Escuchar eventos de creación/eliminación de ventas para recargar SI estamos activos
  // (Estos eventos solo funcionan cuando el cambio ocurre en la MISMA página, ej: eliminar desde UsuarioDetails)
  useEffect(() => {
    const reloadVentas = async () => {
      if (!enabled || clienteIds.length === 0) return;

      // Invalidar cache
      invalidateVentasPorUsuariosCache();
      ventasCache.delete(idsKey);

      setIsLoading(true);
      try {
        // chunks de 30 para evitar límite 'in'
        const ventasBase = await queryVentasPorClienteIds(clienteIds);
        const ventasConDatos = await getVentasConUltimoPago(ventasBase);
        const now = new Date();
        const result: Record<string, VentasUsuarioStats> = {};

        for (const clienteId of clienteIds) {
          const ventasCliente = ventasConDatos.filter(
            (v) => v.clienteId === clienteId && (v.estado ?? 'activo') !== 'inactivo'
          );

          const montoSinConsumir = ventasCliente.reduce((sum, venta) => {
            const fechaInicio = venta.fechaInicio ? new Date(venta.fechaInicio) : null;
            const fechaFin = venta.fechaFin ? new Date(venta.fechaFin) : null;

            if (!fechaInicio || !fechaFin) return sum;

            const totalDias = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
            const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, now), 0);
            const ratioRestante = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
            const montoVenta = totalDias > 0 ? Math.max((venta.precioFinal || 0) * ratioRestante, 0) : 0;

            return sum + montoVenta;
          }, 0);

          result[clienteId] = { montoSinConsumir };
        }

        ventasCache.set(idsKey, { data: result, ts: Date.now() });
        setStats(result);
      } catch (error) {
        console.error('[useVentasPorUsuarios] Error reloading after venta change:', error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('venta-created', reloadVentas);
    window.addEventListener('venta-updated', reloadVentas);
    window.addEventListener('venta-deleted', reloadVentas);

    return () => {
      window.removeEventListener('venta-created', reloadVentas);
      window.removeEventListener('venta-updated', reloadVentas);
      window.removeEventListener('venta-deleted', reloadVentas);
    };
  }, [idsKey, enabled, clienteIds]);

  return { stats, isLoading };
}
