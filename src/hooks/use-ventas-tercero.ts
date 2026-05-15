'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchVentasByClienteUseCase } from '@/lib/use-cases/ventas-use-cases';
import { useVentasStore } from '@/store/ventasStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { VentaDoc } from '@/types';

// -- Cache a nivel de módulo --------------------------------
const CACHE_TTL = CACHE_TTL_MS;

interface CachedVentas {
  data: VentaTerceroDoc[];
  renovaciones: Record<string, number>;
  ts: number;
}

const ventasCache = new Map<string, CachedVentas>();

function shouldInvalidateTerceroVentasCache(cachedTs: number): boolean {
  if (typeof window === 'undefined') return false;

  for (const key of ['venta-deleted', 'venta-created', 'venta-updated', 'servicio-updated']) {
    const value = window.localStorage.getItem(key);
    if (!value) continue;

    const updatedAt = parseInt(value, 10);
    if (!Number.isNaN(updatedAt) && updatedAt > cachedTs) {
      return true;
    }
  }

  return false;
}

/**
 * Venta tal como la devuelve Supabase, con timestamps
 * convertidos a Date para consumo directo en componentes.
 */
export interface VentaTerceroDoc {
  id: string;
  clienteId: string;
  categoriaId: string;
  categoriaNombre: string; // <- Denormalizado (guardado en el doc de Venta)
  servicioId: string;
  servicioNombre: string;
  servicioCorreo: string;
  perfilNumero: number | null | undefined;
  cicloPago: string | undefined;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  precio: number;
  precioFinal: number;
  estado: string;
  moneda: string | undefined;
  /** campos opcionales que pueden existir en el documento */
  [key: string]: unknown;
}

/**
 * Carga las ventas de un solo usuario, el historial de renovaciones
 * de los servicios asociados, y expone una función para eliminar ventas.
 *
 * Cache: 5 minutos. Query de renovaciones optimizada (single query con 'in').
 *
 * @param usuarioId  – id del usuario cuyas ventas se carga
 */
export function useVentasTercero(usuarioId: string) {
  const { deleteVenta: deleteVentaFromStore } = useVentasStore();

  const [ventas, setVentas]                           = useState<VentaTerceroDoc[]>([]);
  const [renovacionesByServicio, setRenovacionesByServicio] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading]                     = useState(true);

  /* -- 1. Ventas del tercero + renovaciones (con cache) -- */
  useEffect(() => {
    if (!usuarioId) {
      setVentas([]);
      setRenovacionesByServicio({});
      setIsLoading(false);
      return;
    }

    // Cache hit
    const cached = ventasCache.get(usuarioId);
    if (cached && Date.now() - cached.ts < CACHE_TTL && !shouldInvalidateTerceroVentasCache(cached.ts)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '%c[VentasTerceroCache]%c HIT · user ' + usuarioId.slice(0, 8) + ' · age ' + Math.round((Date.now() - cached.ts) / 1000) + 's',
          'background:#4CAF50;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
          'color:#4CAF50;font-weight:600'
        );
      }
      setVentas(cached.data);
      setRenovacionesByServicio(cached.renovaciones);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const ventasConDatos = await fetchVentasByClienteUseCase<VentaDoc & { renovaciones?: number }>(usuarioId);

        if (cancelled) return;

        const mapped: VentaTerceroDoc[] = ventasConDatos.map((venta) => ({
          id:              venta.id,
          clienteId:       venta.clienteId || '',
          categoriaId:     venta.categoriaId,
          categoriaNombre: venta.categoriaNombre || 'Sin categoría',
          servicioId:      venta.servicioId,
          servicioNombre:  venta.servicioNombre,
          servicioCorreo:  venta.servicioCorreo || '—',
          perfilNumero:    venta.perfilNumero ?? null,
          cicloPago:       venta.cicloPago,
          fechaInicio:     venta.fechaInicio ?? null,
          fechaFin:        venta.fechaFin ?? null,
          precio:          venta.precio ?? 0,
          precioFinal:     venta.precioFinal ?? venta.precio ?? 0,
          estado:          venta.estado ?? 'activo',
          cortadaAt:       venta.cortadaAt ?? null,
          moneda:          venta.moneda,
        }));

        const renovaciones = Object.fromEntries(
          ventasConDatos.map((venta) => [venta.id, Number(venta.renovaciones ?? 0)])
        );

        if (cancelled) return;

        // Guardar en cache
        ventasCache.set(usuarioId, { data: mapped, renovaciones, ts: Date.now() });

        setVentas(mapped);
        setRenovacionesByServicio(renovaciones);
      } catch (error) {
        console.error('Error cargando datos del tercero:', error);
        if (!cancelled) {
          setVentas([]);
          setRenovacionesByServicio({});
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [usuarioId]);

  useEffect(() => {
    const reloadFromServicioUpdate = async () => {
      if (!usuarioId) return;

      ventasCache.delete(usuarioId);
      setIsLoading(true);

      try {
        const ventasConDatos = await fetchVentasByClienteUseCase<VentaDoc & { renovaciones?: number }>(usuarioId);

        const mapped: VentaTerceroDoc[] = ventasConDatos.map((venta) => ({
          id:              venta.id,
          clienteId:       venta.clienteId || '',
          categoriaId:     venta.categoriaId,
          categoriaNombre: venta.categoriaNombre || 'Sin categoría',
          servicioId:      venta.servicioId,
          servicioNombre:  venta.servicioNombre,
          servicioCorreo:  venta.servicioCorreo || '—',
          perfilNumero:    venta.perfilNumero ?? null,
          cicloPago:       venta.cicloPago,
          fechaInicio:     venta.fechaInicio ?? null,
          fechaFin:        venta.fechaFin ?? null,
          precio:          venta.precio ?? 0,
          precioFinal:     venta.precioFinal ?? venta.precio ?? 0,
          estado:          venta.estado ?? 'activo',
          cortadaAt:       venta.cortadaAt ?? null,
          moneda:          venta.moneda,
        }));

        const renovaciones = Object.fromEntries(
          ventasConDatos.map((venta) => [venta.id, Number(venta.renovaciones ?? 0)])
        );

        ventasCache.set(usuarioId, { data: mapped, renovaciones, ts: Date.now() });
        setVentas(mapped);
        setRenovacionesByServicio(renovaciones);
      } catch (error) {
        console.error('[useVentasTercero] Error reloading after servicio update:', error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('servicio-updated', reloadFromServicioUpdate);
    return () => window.removeEventListener('servicio-updated', reloadFromServicioUpdate);
  }, [usuarioId]);

  /* -- 2. Eliminar venta ---------------------------- */
  const deleteVenta = useCallback(async (ventaId: string, servicioId?: string, perfilNumero?: number | null) => {
    const ventaEliminada = ventas.find(v => v.id === ventaId);

    // Optimistic update en UI
    setVentas((prev) => prev.filter((v) => v.id !== ventaId));

    try {
      await deleteVentaFromStore(ventaId, servicioId, perfilNumero, true);

      // Invalidar cache
      ventasCache.delete(usuarioId);

      // Notificar a otras ventanas/tabs que se eliminó una venta
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('venta-deleted', Date.now().toString());
        window.dispatchEvent(new Event('venta-deleted'));
      }
    } catch (error) {
      // Rollback en caso de error
      if (ventaEliminada) {
        setVentas((prev) => [...prev, ventaEliminada].sort((a, b) => a.id.localeCompare(b.id)));
      }
      throw error;
    }
  }, [deleteVentaFromStore, ventas, usuarioId]);

  return {
    ventas,
    renovacionesByServicio,
    isLoading,
    deleteVenta,
  };
}
