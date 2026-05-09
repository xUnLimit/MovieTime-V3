import { supabase } from './client';
import type { Configuracion, TasasCambio } from '@/types';
import { getOfflineConfig, shouldUseOfflineRead } from '@/lib/pwa/offline-read';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';

const CONFIG_DOC_ID = 'global';

export async function getConfig(): Promise<Configuracion> {
  if (await shouldUseOfflineRead()) {
    const offline = await getOfflineConfig();
    if (offline) return offline;
  }

  const [{ data: config, error: configError }, { data: rates, error: ratesError }] = await Promise.all([
    supabase.from('config').select('*').eq('id', CONFIG_DOC_ID).single(),
    supabase.from('exchange_rates').select('*'),
  ]);

  if (configError) throw new Error(configError.message);
  if (ratesError) throw new Error(ratesError.message);

  const rateMap = Object.fromEntries(
    (rates ?? []).map((rate) => [rate.currency_pair, Number(rate.rate)])
  ) as Omit<TasasCambio, 'ultimaActualizacion'>;

  const lastUpdated = (rates ?? []).reduce<Date>((latest, rate) => {
    const next = new Date(rate.last_updated);
    return next > latest ? next : latest;
  }, new Date(config.updated_at));

  return {
    id: 'global',
    tasasCambio: {
      ...rateMap,
      USD_PAB: rateMap.USD_PAB ?? 1,
      USD_EUR: rateMap.USD_EUR ?? 1,
      USD_NGN: rateMap.USD_NGN ?? 1,
      ultimaActualizacion: lastUpdated,
    } as TasasCambio,
    notificaciones: {
      diasAntes: [config.notificaciones_dias_anticipacion],
      horaEnvio: config.hora_envio,
    },
    executivePush: {
      enabled: Boolean(config.executive_push_enabled ?? false),
      sendTime: typeof config.executive_push_send_time === 'string' ? config.executive_push_send_time : '08:00',
      timezone: typeof config.executive_push_timezone === 'string' ? config.executive_push_timezone : 'America/Bogota',
      selectedBlocks: Array.isArray(config.executive_push_selected_blocks)
        ? config.executive_push_selected_blocks as Configuracion['executivePush']['selectedBlocks']
        : [],
      blockOrder: Array.isArray(config.executive_push_block_order)
        ? config.executive_push_block_order as Configuracion['executivePush']['blockOrder']
        : [],
      updatedBy: typeof config.executive_push_updated_by === 'string' ? config.executive_push_updated_by : undefined,
      updatedAt: new Date(config.updated_at),
      lastSentAt: typeof config.executive_push_last_sent_at === 'string' ? new Date(config.executive_push_last_sent_at) : null,
      lastSentDate: typeof config.executive_push_last_sent_date === 'string' ? config.executive_push_last_sent_date : null,
    },
    whatsapp: {
      prefijoTelefono: config.whatsapp_prefijo,
    },
    updatedAt: new Date(config.updated_at),
  };
}

export async function upsertExchangeRates(tasasUpdates: Partial<TasasCambio>) {
  assertOnlineMutation();
  const rows = Object.entries(tasasUpdates)
    .filter(([key, value]) => key !== 'ultimaActualizacion' && typeof value === 'number')
    .map(([currencyPair, rate]) => ({
      currency_pair: currencyPair,
      rate: Number(rate),
      source: 'app-config',
      last_updated: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'currency_pair' });
  if (error) throw new Error(error.message);
}

export async function updateNotificationLeadDays(diasAnticipacion: number) {
  assertOnlineMutation();
  await updateConfig({ notificaciones_dias_anticipacion: diasAnticipacion });
}

export async function updateNotificationSendHour(horaEnvio: number) {
  assertOnlineMutation();
  await updateConfig({ hora_envio: horaEnvio });
}

export async function updateWhatsappPrefix(prefijo: string) {
  assertOnlineMutation();
  await updateConfig({ whatsapp_prefijo: prefijo });
}

export async function updateExecutivePushSettings(payload: {
  executive_push_enabled?: boolean;
  executive_push_send_time?: string;
  executive_push_timezone?: string;
  executive_push_selected_blocks?: string[];
  executive_push_block_order?: string[];
  executive_push_updated_by?: string | null;
}) {
  assertOnlineMutation();
  await updateConfig(payload);
}

async function updateConfig(payload: {
  notificaciones_dias_anticipacion?: number;
  hora_envio?: number;
  whatsapp_prefijo?: string;
  executive_push_enabled?: boolean;
  executive_push_send_time?: string;
  executive_push_timezone?: string;
  executive_push_selected_blocks?: string[];
  executive_push_block_order?: string[];
  executive_push_updated_by?: string | null;
}) {
  const { error } = await supabase.from('config').update(payload).eq('id', CONFIG_DOC_ID);
  if (error) throw new Error(error.message);
}
