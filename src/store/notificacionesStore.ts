/**
 * Notificaciones Store - Zustand
 *
 * Manages notification state and persistence
 * Synced with Firestore `notificaciones` collection
 *
 * Features:
 * - CRUD operations for notifications
 * - Mark as read/unread
 * - Mark as highlighted/starred
 * - Filter by entity type (venta/servicio)
 * - Caching with 5-minute TTL
 * - Error state management
 * - Optimistic updates with rollback
 */

import { create } from 'zustand';
import {
  COLLECTIONS,
  queryDocuments,
  getCount,
  update,
  remove,
} from '@/lib/firebase/firestore';
import type { Notificacion, NotificacionVenta, NotificacionServicio, NotificacionReposo } from '@/types/notificaciones';
import { esNotificacionVenta, esNotificacionServicio, esNotificacionReposo } from '@/types/notificaciones';

interface NotificacionesState {
  // State
  notificaciones: (Notificacion & { id: string })[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  // Queries
  totalNotificaciones: number;
  ventasProximas: number;
  serviciosProximos: number;
  reposoCompletados: number;

  // Actions - Data fetching
  fetchNotificaciones: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;

  // Actions - Mutations
  toggleLeida: (notifId: string, leida: boolean) => Promise<void>;
  toggleResaltada: (notifId: string, resaltada: boolean) => Promise<void>;
  deleteNotificacion: (notifId: string) => Promise<void>;
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteNotificacionesPorServicio: (servicioId: string) => Promise<void>;

  // Helpers
  getVentasNotificaciones: () => (NotificacionVenta & { id: string })[];
  getServiciosNotificaciones: () => (NotificacionServicio & { id: string })[];
  getReposoNotificaciones: () => (NotificacionReposo & { id: string })[];
  getNotificacionesResaltadas: () => (Notificacion & { id: string })[];
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
  // Initial state
  notificaciones: [],
  isLoading: false,
  error: null,
  lastFetch: null,

  totalNotificaciones: 0,
  ventasProximas: 0,
  serviciosProximos: 0,
  reposoCompletados: 0,

  /**
   * Fetch all notifications from Firestore
   * Uses cache with 5-minute TTL
   */
  fetchNotificaciones: async (force = false) => {
    const state = get();

    // Check cache
    if (
      !force &&
      state.lastFetch &&
      Date.now() - state.lastFetch < CACHE_TTL
    ) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const notificaciones = (await queryDocuments(COLLECTIONS.NOTIFICACIONES, [])) as (
        Notificacion & { id: string }
      )[];

      // Calculate counts from fetched data
      const totalNotificaciones = notificaciones.length;
      const ventasProximas = notificaciones.filter(esNotificacionVenta).length;
      const serviciosProximos = notificaciones.filter(esNotificacionServicio).length;
      const reposoCompletados = notificaciones.filter(esNotificacionReposo).length;

      set({
        notificaciones,
        totalNotificaciones,
        ventasProximas,
        serviciosProximos,
        reposoCompletados,
        isLoading: false,
        error: null,
        lastFetch: Date.now(),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        error: errorMessage,
        isLoading: false,
        notificaciones: [],
      });
      console.error('[NotificacionesStore] Error fetching notifications:', error);
    }
  },

  /**
   * Fetch count metrics using getCount() — free on Spark plan, 0 document reads
   */
  fetchCounts: async () => {
    try {
      const [totalNotificaciones, ventasProximas, serviciosProximas, reposoCompletados] = await Promise.all([
        getCount(COLLECTIONS.NOTIFICACIONES),
        getCount(COLLECTIONS.NOTIFICACIONES, [{ field: 'entidad', operator: '==', value: 'venta' }]),
        getCount(COLLECTIONS.NOTIFICACIONES, [{ field: 'entidad', operator: '==', value: 'servicio' }]),
        getCount(COLLECTIONS.NOTIFICACIONES, [{ field: 'entidad', operator: '==', value: 'reposo' }]),
      ]);

      set({
        totalNotificaciones,
        ventasProximas,
        serviciosProximos: serviciosProximas,
        reposoCompletados,
      });

    } catch (error) {
      console.error('[NotificacionesStore] Error fetching counts:', error);
      set({
        totalNotificaciones: 0,
        ventasProximas: 0,
        serviciosProximos: 0,
        reposoCompletados: 0,
      });
    }
  },

  /**
   * Mark notification as read/unread
   */
  toggleLeida: async (notifId: string, leida: boolean) => {
    const state = get();

    // Optimistic update
    const updatedNotifs = state.notificaciones.map((n) =>
      n.id === notifId ? { ...n, leida } : n
    );
    set({ notificaciones: updatedNotifs });

    try {
      await update(COLLECTIONS.NOTIFICACIONES, notifId, {
        leida,
        updatedAt: new Date(),
      });
    } catch (error) {
      // Rollback on error
      set({ notificaciones: state.notificaciones });
      console.error('[NotificacionesStore] Error updating leida:', error);
      throw error;
    }
  },

  /**
   * Mark notification as highlighted/starred
   */
  toggleResaltada: async (notifId: string, resaltada: boolean) => {
    const state = get();

    // Optimistic update
    const updatedNotifs = state.notificaciones.map((n) =>
      n.id === notifId ? { ...n, resaltada } : n
    );
    set({ notificaciones: updatedNotifs });

    try {
      await update(COLLECTIONS.NOTIFICACIONES, notifId, {
        resaltada,
        updatedAt: new Date(),
      });
    } catch (error) {
      // Rollback on error
      set({ notificaciones: state.notificaciones });
      console.error('[NotificacionesStore] Error updating resaltada:', error);
      throw error;
    }
  },

  /**
   * Delete a single notification
   */
  deleteNotificacion: async (notifId: string) => {
    const state = get();

    // Optimistic update
    const updatedNotifs = state.notificaciones.filter((n) => n.id !== notifId);

    // Update counts
    const totalNotificaciones = updatedNotifs.length;
    const ventasProximas = updatedNotifs.filter(esNotificacionVenta).length;
    const serviciosProximos = updatedNotifs.filter(esNotificacionServicio).length;
    const reposoCompletados = updatedNotifs.filter(esNotificacionReposo).length;

    set({
      notificaciones: updatedNotifs,
      totalNotificaciones,
      ventasProximas,
      serviciosProximos,
      reposoCompletados,
    });

    try {
      await remove(COLLECTIONS.NOTIFICACIONES, notifId);
    } catch (error) {
      // Rollback on error
      set({
        notificaciones: state.notificaciones,
        totalNotificaciones: state.totalNotificaciones,
        ventasProximas: state.ventasProximas,
        serviciosProximos: state.serviciosProximos,
        reposoCompletados: state.reposoCompletados,
      });
      console.error('[NotificacionesStore] Error deleting notification:', error);
      throw error;
    }
  },

  /**
   * Delete all notifications for a specific venta
   * Called when venta is deleted or renewed
   */
  deleteNotificacionesPorVenta: async (ventaId: string) => {
    const state = get();

    // Find notifications to delete
    const notifsToDelete = state.notificaciones.filter(
      (n) => esNotificacionVenta(n) && n.ventaId === ventaId
    );

    // Optimistic update
    const updatedNotifs = state.notificaciones.filter(
      (n) => !(esNotificacionVenta(n) && n.ventaId === ventaId)
    );

    // Update counts
    const totalNotificaciones = updatedNotifs.length;
    const ventasProximas = updatedNotifs.filter(esNotificacionVenta).length;
    const serviciosProximos = updatedNotifs.filter(esNotificacionServicio).length;
    const reposoCompletados = updatedNotifs.filter(esNotificacionReposo).length;

    set({
      notificaciones: updatedNotifs,
      totalNotificaciones,
      ventasProximas,
      serviciosProximos,
      reposoCompletados,
    });

    try {
      // Delete all notifications for this venta
      await Promise.all(
        notifsToDelete.map((n) =>
          remove(COLLECTIONS.NOTIFICACIONES, n.id).catch((error) => {
            console.error(`[NotificacionesStore] Error deleting notif ${n.id}:`, error);
          })
        )
      );
    } catch (error) {
      // Rollback on error
      set({
        notificaciones: state.notificaciones,
        totalNotificaciones: state.totalNotificaciones,
        ventasProximas: state.ventasProximas,
        serviciosProximos: state.serviciosProximos,
        reposoCompletados: state.reposoCompletados,
      });
      console.error('[NotificacionesStore] Error deleting venta notifications:', error);
      throw error;
    }
  },

  /**
   * Delete all notifications for a specific servicio
   * Called when servicio is deleted or renewed
   */
  deleteNotificacionesPorServicio: async (servicioId: string) => {
    const state = get();

    // Find notifications to delete
    const notifsToDelete = state.notificaciones.filter(
      (n) => esNotificacionServicio(n) && n.servicioId === servicioId
    );

    // Optimistic update
    const updatedNotifs = state.notificaciones.filter(
      (n) => !(esNotificacionServicio(n) && n.servicioId === servicioId)
    );

    // Update counts
    const totalNotificaciones = updatedNotifs.length;
    const ventasProximas = updatedNotifs.filter(esNotificacionVenta).length;
    const serviciosProximos = updatedNotifs.filter(esNotificacionServicio).length;
    const reposoCompletados = updatedNotifs.filter(esNotificacionReposo).length;

    set({
      notificaciones: updatedNotifs,
      totalNotificaciones,
      ventasProximas,
      serviciosProximos,
      reposoCompletados,
    });

    try {
      // Delete all notifications for this servicio
      await Promise.all(
        notifsToDelete.map((n) =>
          remove(COLLECTIONS.NOTIFICACIONES, n.id).catch((error) => {
            console.error(`[NotificacionesStore] Error deleting notif ${n.id}:`, error);
          })
        )
      );
    } catch (error) {
      // Rollback on error
      set({
        notificaciones: state.notificaciones,
        totalNotificaciones: state.totalNotificaciones,
        ventasProximas: state.ventasProximas,
        serviciosProximos: state.serviciosProximos,
        reposoCompletados: state.reposoCompletados,
      });
      console.error('[NotificacionesStore] Error deleting servicio notifications:', error);
      throw error;
    }
  },

  // Helpers

  /**
   * Get all venta notifications with type safety
   */
  getVentasNotificaciones: () => {
    return get().notificaciones.filter(esNotificacionVenta) as (NotificacionVenta & {
      id: string;
    })[];
  },

  /**
   * Get all servicio notifications with type safety
   */
  getServiciosNotificaciones: () => {
    return get().notificaciones.filter(esNotificacionServicio) as (NotificacionServicio & {
      id: string;
    })[];
  },

  getReposoNotificaciones: () => {
    return get().notificaciones.filter(esNotificacionReposo) as (NotificacionReposo & {
      id: string;
    })[];
  },

  /**
   * Get all highlighted/starred notifications
   */
  getNotificacionesResaltadas: () => {
    return get().notificaciones.filter((n) => n.resaltada);
  },
}));
