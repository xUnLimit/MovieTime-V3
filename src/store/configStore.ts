import { ENTITIES, logCacheHit } from '@/lib/supabase/catalogos-repository';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getConfig,
  updateNotificationLeadDays,
  updateNotificationSendHour,
  updateWhatsappPrefix,
  upsertExchangeRates,
} from '@/lib/supabase/config-repository';
import type { Configuracion, TasasCambio } from '@/types';

interface ConfigState {
  config: Configuracion | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  // Actions
  fetchConfig: (force?: boolean) => Promise<void>;
  updateTasasCambio: (tasas: Partial<TasasCambio>) => Promise<void>;
  updateDiasNotificacion: (dias: number[]) => Promise<void>;
  updateHoraEnvio: (hora: number) => Promise<void>;
  updatePrefijoWhatsApp: (prefijo: string) => Promise<void>;
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

export const useConfigStore = create<ConfigState>()(
  devtools(
    (set, get) => ({
      config: null,
      isLoading: false,
      error: null,
      lastFetch: null,

      fetchConfig: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.CONFIG);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const config = await getConfig();
          set({ config, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar configuracion';
          console.error('Error fetching config:', error);
          set({ isLoading: false, error: errorMessage });
        }
      },

      updateTasasCambio: async (tasasUpdates) => {
        await upsertExchangeRates(tasasUpdates);

        set((state) => ({
          config: state.config
            ? {
                ...state.config,
                tasasCambio: {
                  ...state.config.tasasCambio,
                  ...tasasUpdates,
                  ultimaActualizacion: new Date(),
                },
                updatedAt: new Date(),
              }
            : null,
        }));
      },

      updateDiasNotificacion: async (dias) => {
        const diasAnticipacion = Math.min(60, Math.max(1, dias[0] ?? 7));
        await updateNotificationLeadDays(diasAnticipacion);

        set((state) => ({
          config: state.config
            ? {
                ...state.config,
                notificaciones: {
                  ...state.config.notificaciones,
                  diasAntes: [diasAnticipacion],
                },
                updatedAt: new Date(),
              }
            : null,
        }));
      },

      updateHoraEnvio: async (hora) => {
        const safeHora = Math.min(23, Math.max(0, hora));
        await updateNotificationSendHour(safeHora);

        set((state) => ({
          config: state.config
            ? {
                ...state.config,
                notificaciones: {
                  ...state.config.notificaciones,
                  horaEnvio: safeHora,
                },
                updatedAt: new Date(),
              }
            : null,
        }));
      },

      updatePrefijoWhatsApp: async (prefijo) => {
        await updateWhatsappPrefix(prefijo);

        set((state) => ({
          config: state.config
            ? {
                ...state.config,
                whatsapp: {
                  prefijoTelefono: prefijo,
                },
                updatedAt: new Date(),
              }
            : null,
        }));
      },
    }),
    { name: 'config-store' }
  )
);
