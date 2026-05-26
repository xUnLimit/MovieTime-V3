import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  updateNotificationLeadDays,
  updateNotificationSendHour,
  updateExecutivePushSettings,
  updateWhatsappPrefix,
  upsertExchangeRates,
} from '@/lib/supabase/config-repository';
import type { ExecutivePushSettings, TasasCambio } from '@/types';

function sameArray(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  if (left === undefined && right === undefined) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

interface ConfigMutationState {
  updateTasasCambio: (tasas: Partial<TasasCambio>) => Promise<void>;
  updateDiasNotificacion: (dias: number[]) => Promise<void>;
  updateHoraEnvio: (hora: number) => Promise<void>;
  updatePrefijoWhatsApp: (prefijo: string) => Promise<void>;
  updateExecutivePush: (
    updates: Partial<ExecutivePushSettings>,
    currentExecutivePush?: ExecutivePushSettings,
  ) => Promise<void>;
}

export const useConfigStore = create<ConfigMutationState>()(
  devtools(
    () => ({
      updateTasasCambio: async (tasasUpdates) => {
        await upsertExchangeRates(tasasUpdates);
      },

      updateDiasNotificacion: async (dias) => {
        const diasAnticipacion = Math.min(60, Math.max(1, dias[0] ?? 7));
        await updateNotificationLeadDays(diasAnticipacion);
      },

      updateHoraEnvio: async (hora) => {
        const safeHora = Math.min(23, Math.max(0, hora));
        await updateNotificationSendHour(safeHora);
      },

      updatePrefijoWhatsApp: async (prefijo) => {
        await updateWhatsappPrefix(prefijo);
      },

      updateExecutivePush: async (updates, currentExecutivePush) => {
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
      },
    }),
    { name: 'config-store' }
  )
);
