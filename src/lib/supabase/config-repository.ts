import { supabase } from './client';
import type { Configuracion, TasasCambio } from '@/types';

const CONFIG_DOC_ID = 'global';

export async function getConfig(): Promise<Configuracion> {
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
    whatsapp: {
      prefijoTelefono: config.whatsapp_prefijo,
    },
    updatedAt: new Date(config.updated_at),
  };
}

export async function upsertExchangeRates(tasasUpdates: Partial<TasasCambio>) {
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
  await updateConfig({ notificaciones_dias_anticipacion: diasAnticipacion });
}

export async function updateNotificationSendHour(horaEnvio: number) {
  await updateConfig({ hora_envio: horaEnvio });
}

export async function updateWhatsappPrefix(prefijo: string) {
  await updateConfig({ whatsapp_prefijo: prefijo });
}

async function updateConfig(payload: {
  notificaciones_dias_anticipacion?: number;
  hora_envio?: number;
  whatsapp_prefijo?: string;
}) {
  const { error } = await supabase.from('config').update(payload).eq('id', CONFIG_DOC_ID);
  if (error) throw new Error(error.message);
}
