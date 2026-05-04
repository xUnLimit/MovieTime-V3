'use client';

import { useCallback, useEffect, useState } from 'react';
import { COLLECTIONS, queryDocuments, remove, adjustServiciosActivos, adjustCategoriaSuscripciones } from '@/lib/firebase/firestore';
import { useServiciosStore } from '@/store/serviciosStore';
import { getVentasConUltimoPago } from '@/lib/services/ventaSyncService';
import type { VentaDoc } from '@/types';

// ── Cache a nivel de módulo ────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

interface CachedVentas {
  data: VentaUsuarioDoc[];
  renovaciones: Record<string, number>;
  ts: number;
}

const ventasCache = new Map<string, CachedVentas>();

function shouldInvalidateUsuarioVentasCache(cachedTs: number): boolean {
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
 * Venta tal como la devuelve Firestore, con timestamps
 * convertidos a Date para consumo directo en componentes.
 */
export interface VentaUsuarioDoc {
  id: string;
  clienteId: string;
  categoriaId: string;
  categoriaNombre: string; // ← Denormalizado (guardado en el doc de Venta)
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
export function useVentasUsuario(usuarioId: string) {
  const { updatePerfilOcupado } = useServiciosStore();

  const [ventas, setVentas]                           = useState<VentaUsuarioDoc[]>([]);
  const [renovacionesByServicio, setRenovacionesByServicio] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading]                     = useState(true);

  /* ── 1. Ventas del usuario + renovaciones (con cache) ── */
  useEffect(() => {
    if (!usuarioId) {
      setVentas([]);
      setRenovacionesByServicio({});
      setIsLoading(false);
      return;
    }

    // Cache hit
    const cached = ventasCache.get(usuarioId);
    if (cached && Date.now() - cached.ts < CACHE_TTL && !shouldInvalidateUsuarioVentasCache(cached.ts)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '%c[VentasUsuarioCache]%c HIT · user ' + usuarioId.slice(0, 8) + ' · age ' + Math.round((Date.now() - cached.ts) / 1000) + 's',
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
        // Paso 1: Cargar ventas base (solo metadatos)
        const ventasBase = await queryDocuments<VentaDoc>(COLLECTIONS.VENTAS, [
          { field: 'clienteId', operator: '==', value: usuarioId },
        ]);


        if (cancelled) return;

        // Paso 2: Cargar datos actuales desde PagoVenta (fuente de verdad)
        const ventasConDatos = await getVentasConUltimoPago(ventasBase);

        if (cancelled) return;

        const mapped: VentaUsuarioDoc[] = ventasConDatos.map((venta) => ({
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
          moneda:          venta.moneda,
        }));

        // Query 2: Renovaciones por venta (desde pagosVenta)
        const ventaIds = mapped.map((v) => v.id).filter(Boolean);

        let renovaciones: Record<string, number> = {};
        if (ventaIds.length > 0) {
          // Firestore 'in' acepta max 10 valores — si hay más, partir en chunks
          const chunks: string[][] = [];
          for (let i = 0; i < ventaIds.length; i += 10) {
            chunks.push(ventaIds.slice(i, i + 10));
          }

          const allPagos = await Promise.all(
            chunks.map(chunk =>
              queryDocuments<Record<string, unknown>>(COLLECTIONS.PAGOS_VENTA, [
                { field: 'ventaId', operator: 'in', value: chunk },
              ])
            )
          );

          const pagos = allPagos.flat();

          // Contar renovaciones por venta (excluir pago inicial)
          const renovacionesMap: Record<string, number> = {};
          pagos.forEach((pago) => {
            const ventaId = pago.ventaId as string;
            if (!ventaId) return;
            const isPagoInicial = pago.isPagoInicial === true;
            if (!isPagoInicial) {
              renovacionesMap[ventaId] = (renovacionesMap[ventaId] || 0) + 1;
            }
          });
          renovaciones = renovacionesMap;
        }

        if (cancelled) return;

        // Guardar en cache
        ventasCache.set(usuarioId, { data: mapped, renovaciones, ts: Date.now() });

        setVentas(mapped);
        setRenovacionesByServicio(renovaciones);
      } catch (error) {
        console.error('Error cargando datos del usuario:', error);
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
        const ventasBase = await queryDocuments<VentaDoc>(COLLECTIONS.VENTAS, [
          { field: 'clienteId', operator: '==', value: usuarioId }
        ]);
        const ventasConDatos = await getVentasConUltimoPago(ventasBase);

        const mapped: VentaUsuarioDoc[] = ventasConDatos.map((venta) => ({
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
          moneda:          venta.moneda,
        }));

        const ventaIds = mapped.map((v) => v.id).filter(Boolean);
        let renovaciones: Record<string, number> = {};

        if (ventaIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < ventaIds.length; i += 10) {
            chunks.push(ventaIds.slice(i, i + 10));
          }

          const allPagos = await Promise.all(
            chunks.map((chunk) =>
              queryDocuments<Record<string, unknown>>(COLLECTIONS.PAGOS_VENTA, [
                { field: 'ventaId', operator: 'in', value: chunk },
              ])
            )
          );

          const pagos = allPagos.flat();
          const renovacionesMap: Record<string, number> = {};

          pagos.forEach((pago) => {
            const ventaId = pago.ventaId as string;
            if (!ventaId || pago.isPagoInicial === true) return;
            renovacionesMap[ventaId] = (renovacionesMap[ventaId] || 0) + 1;
          });
          renovaciones = renovacionesMap;
        }

        ventasCache.set(usuarioId, { data: mapped, renovaciones, ts: Date.now() });
        setVentas(mapped);
        setRenovacionesByServicio(renovaciones);
      } catch (error) {
        console.error('[useVentasUsuario] Error reloading after servicio update:', error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('servicio-updated', reloadFromServicioUpdate);
    return () => window.removeEventListener('servicio-updated', reloadFromServicioUpdate);
  }, [usuarioId]);

  /* ── 2. Eliminar venta ──────────────────────────── */
  const deleteVenta = useCallback(async (ventaId: string, servicioId?: string, perfilNumero?: number | null) => {
    const ventaEliminada = ventas.find(v => v.id === ventaId);

    // Optimistic update en UI
    setVentas((prev) => prev.filter((v) => v.id !== ventaId));

    try {
      // Eliminar todos los pagos asociados primero
      const pagosVenta = await queryDocuments<{ id: string }>(COLLECTIONS.PAGOS_VENTA, [
        { field: 'ventaId', operator: '==', value: ventaId }
      ]);

      await Promise.all(
        pagosVenta.map(pago => remove(COLLECTIONS.PAGOS_VENTA, pago.id))
      );

      // Eliminar la venta
      await remove(COLLECTIONS.VENTAS, ventaId);

      // Actualizar perfil ocupado del servicio
      if (servicioId && perfilNumero) {
        updatePerfilOcupado(servicioId, false);
      }

      // Decrementar ventasActivas si la venta eliminada era activa
      if (ventaEliminada && (ventaEliminada.estado ?? 'activo') !== 'inactivo') {
        await adjustServiciosActivos(usuarioId, -1);
      }

      // Decrementar contadores de la categoría
      if (ventaEliminada?.categoriaId && ventaEliminada?.precioFinal) {
        await adjustCategoriaSuscripciones(
          ventaEliminada.categoriaId,
          -1,
          -ventaEliminada.precioFinal
        );
      }

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
  }, [updatePerfilOcupado, ventas, usuarioId]);

  return {
    ventas,
    renovacionesByServicio,
    isLoading,
    deleteVenta,
  };
}
