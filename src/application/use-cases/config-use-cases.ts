import {
  getConfig,
  updateExecutivePushSettings,
  updateNotificationLeadDays,
  updateNotificationSendHour,
  updateWhatsappPrefix,
  upsertExchangeRates,
} from '@/platform/supabase/config-repository';
import type { ExecutivePushSettings, TasasCambio } from '@/types';

function sameArray(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  if (left === undefined && right === undefined) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function getConfigUseCase() {
  return getConfig();
}

export function updateTasasCambioUseCase(tasasUpdates: Partial<TasasCambio>) {
  return upsertExchangeRates(tasasUpdates);
}

export function updateDiasNotificacionUseCase(dias: number[]) {
  const diasAnticipacion = Math.min(60, Math.max(1, dias[0] ?? 7));
  return updateNotificationLeadDays(diasAnticipacion);
}

export function updateHoraEnvioUseCase(hora: number) {
  const safeHora = Math.min(23, Math.max(0, hora));
  return updateNotificationSendHour(safeHora);
}

export function updatePrefijoWhatsAppUseCase(prefijo: string) {
  return updateWhatsappPrefix(prefijo);
}

export function updateExecutivePushUseCase(
  updates: Partial<ExecutivePushSettings>,
  currentExecutivePush?: ExecutivePushSettings,
) {
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

  return updateExecutivePushSettings({
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
      ? { executive_push_last_sent_at: null, executive_push_last_sent_date: null, executive_push_last_sent_slot: null }
      : {}),
  });
}
