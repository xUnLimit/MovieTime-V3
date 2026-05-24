/**
 * Notificaciones Store - Zustand
 *
 * Manages notification state and persistence
 * Synced with Supabase `notificaciones` table
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
import { subscribeWithSelector } from 'zustand/middleware';

import {
  queryNotificaciones,
  removeNotificacion,
  updateNotificacion,
} from '@/lib/supabase/notifications-repository';
import { CACHE_TTL_MS } from '@/lib/constants';
import {
  getNotificationListState,
  getTypedReposoNotifications,
  getTypedServicioNotifications,
  getTypedVentaNotifications,
  removeServicioNotifications,
  removeVentaNotifications,
  type NotificacionConId,
} from '@/lib/notifications/notification-store-state';
import type { Notificacion, NotificacionVenta, NotificacionServicio, NotificacionReposo } from '@/types/notificaciones';
import {
  fetchNotificationCounts,
  getServicioNotificationsToDelete,
  getVentaNotificationsToDelete,
  updateNotificationFlag,
} from './notificacionesStoreHelpers';

interface NotificacionesState {
  // State
  notificaciones: NotificacionConId[];
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

const CACHE_TTL = CACHE_TTL_MS;

export const useNotificacionesStore = create<NotificacionesState>()(subscribeWithSelector((set, get) => ({
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
   * Fetch all notifications from Supabase
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
      const notificaciones = (await queryNotificaciones([])) as NotificacionConId[];

      set({
        ...getNotificationListState(notificaciones),
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

  fetchCounts: async () => {
    try {
      set(await fetchNotificationCounts());

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

  toggleLeida: async (notifId: string, leida: boolean) => {
    const state = get();

    // Optimistic update
    const updatedNotifs = updateNotificationFlag(state.notificaciones, notifId, { leida });
    set({ notificaciones: updatedNotifs });

    try {
      await updateNotificacion(notifId, {
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

  toggleResaltada: async (notifId: string, resaltada: boolean) => {
    const state = get();

    // Optimistic update
    const updatedNotifs = updateNotificationFlag(state.notificaciones, notifId, { resaltada });
    set({ notificaciones: updatedNotifs });

    try {
      await updateNotificacion(notifId, {
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

    set(getNotificationListState(updatedNotifs));

    try {
      await removeNotificacion(notifId);
    } catch (error) {
      // Rollback on error
      set(getNotificationListState(state.notificaciones));
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

    const notifsToDelete = await getVentaNotificationsToDelete(
      state.notificaciones,
      ventaId,
    );

    // Optimistic update
    const updatedNotifs = removeVentaNotifications(
      state.notificaciones,
      ventaId,
    );

    set(getNotificationListState(updatedNotifs));

    try {
      // Delete all notifications for this venta
      await Promise.all(
        notifsToDelete.map((n) => removeNotificacion(n.id))
      );
    } catch (error) {
      // Rollback on error
      set(getNotificationListState(state.notificaciones));
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

    const notifsToDelete = await getServicioNotificationsToDelete(
      state.notificaciones,
      servicioId,
    );

    // Optimistic update
    const updatedNotifs = removeServicioNotifications(
      state.notificaciones,
      servicioId,
    );

    set(getNotificationListState(updatedNotifs));

    try {
      // Delete all notifications for this servicio
      await Promise.all(
        notifsToDelete.map((n) => removeNotificacion(n.id))
      );
    } catch (error) {
      // Rollback on error
      set(getNotificationListState(state.notificaciones));
      console.error('[NotificacionesStore] Error deleting servicio notifications:', error);
      throw error;
    }
  },

  // Helpers

  /**
   * Get all venta notifications with type safety
   */
  getVentasNotificaciones: () => {
    return getTypedVentaNotifications(get().notificaciones);
  },

  /**
   * Get all servicio notifications with type safety
   */
  getServiciosNotificaciones: () => {
    return getTypedServicioNotifications(get().notificaciones);
  },

  getReposoNotificaciones: () => {
    return getTypedReposoNotifications(get().notificaciones);
  },

  /**
   * Get all highlighted/starred notifications
   */
  getNotificacionesResaltadas: () => {
    return get().notificaciones.filter((n) => n.resaltada);
  },
})));
