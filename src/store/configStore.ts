import { ENTITIES, logCacheHit } from '@/lib/supabase/catalogos-repository';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getConfig,
  updateNotificationLeadDays,
  updateNotificationSendHour,
  updateExecutivePushSettings,
  updateWhatsappPrefix,
  upsertExchangeRates,
} from '@/lib/supabase/config-repository';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { Configuracion, ExecutivePushSettings, TasasCambio } from '@/types';

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
  updateExecutivePush: (updates: Partial<ExecutivePushSettings>) => Promise<void>;
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

function sameArray(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  if (left === undefined && right === undefined) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

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

      updateExecutivePush: async (updates) => {
        const currentExecutivePush = get().config?.executivePush;
        let shouldResetLastSent = false;
        if (currentExecutivePush) {
          shouldResetLastSent =
            (updates.enabled === true && currentExecutivePush.enabled === false) ||
            (updates.sendTime !== undefined && updates.sendTime !== currentExecutivePush.sendTime) ||
            (updates.windowStart !== undefined && updates.windowStart !== currentExecutivePush.windowStart) ||
            (updates.windowEnd !== undefined && updates.windowEnd !== currentExecutivePush.windowEnd) ||
            (updates.intervalHours !== undefined && updates.intervalHours !== currentExecutivePush.intervalHours) ||
            (updates.timezone !== undefined && updates.timezone !== currentExecutivePush.timezone) ||
            (updates.selectedBlocks !== undefined && !sameArray(updates.selectedBlocks, currentExecutivePush.selectedBlocks)) ||
            (updates.blockOrder !== undefined && !sameArray(updates.blockOrder, currentExecutivePush.blockOrder));
        }

        await updateExecutivePushSettings({
          executive_push_enabled: updates.enabled,
          executive_push_send_time: updates.sendTime,
          executive_push_window_start: updates.windowStart,
          executive_push_window_end: updates.windowEnd,
          executive_push_interval_hours: updates.intervalHours,
          executive_push_timezone: updates.timezone,
          executive_push_selected_blocks: updates.selectedBlocks,
          executive_push_block_order: updates.blockOrder,
          executive_push_updated_by: updates.updatedBy ?? null,
          ...(shouldResetLastSent
            ? { executive_push_last_sent_at: null, executive_push_last_sent_date: null }
            : {}),
        });

        set((state) => ({
          config: state.config
            ? {
                ...state.config,
                executivePush: {
                  ...state.config.executivePush,
                  ...updates,
                  ...(shouldResetLastSent ? { lastSentAt: null, lastSentDate: null } : {}),
                  updatedAt: new Date(),
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
