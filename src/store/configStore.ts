import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Configuracion, TasasCambio } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { logCacheHit, ENTITIES } from '@/lib/supabase/catalogos-repository';

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

const CONFIG_DOC_ID = 'global';
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
          const config = await fetchSupabaseConfig();
          set({ config, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar configuracion';
          console.error('Error fetching config:', error);
          set({ isLoading: false, error: errorMessage });
        }
      },

      updateTasasCambio: async (tasasUpdates) => {
        const entries = Object.entries(tasasUpdates).filter(
          ([key, value]) => key !== 'ultimaActualizacion' && typeof value === 'number'
        );

        const rows = entries.map(([currencyPair, rate]) => ({
          currency_pair: currencyPair,
          rate: Number(rate),
          source: 'app-config',
          last_updated: new Date().toISOString(),
        }));

        if (rows.length > 0) {
          const { error } = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'currency_pair' });
          if (error) throw new Error(error.message);
        }

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
        const { error } = await supabase
          .from('config')
          .update({ notificaciones_dias_anticipacion: diasAnticipacion })
          .eq('id', CONFIG_DOC_ID);
        if (error) throw new Error(error.message);

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
        const { error } = await supabase
          .from('config')
          .update({ hora_envio: safeHora })
          .eq('id', CONFIG_DOC_ID);
        if (error) throw new Error(error.message);

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
        const { error } = await supabase
          .from('config')
          .update({ whatsapp_prefijo: prefijo })
          .eq('id', CONFIG_DOC_ID);
        if (error) throw new Error(error.message);

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

async function fetchSupabaseConfig(): Promise<Configuracion> {
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
