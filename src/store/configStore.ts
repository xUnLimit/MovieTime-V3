import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Configuracion, TasasCambio } from '@/types';
import { getById, update, COLLECTIONS, logCacheHit } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';

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
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.CONFIG);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const config = await getById<Configuracion>(COLLECTIONS.CONFIG, CONFIG_DOC_ID);

          if (config) {
            set({ config, isLoading: false, error: null, lastFetch: Date.now() });
          } else {
            set({ isLoading: false, error: null, lastFetch: Date.now() });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar configuración';
          console.error('Error fetching config:', error);
          set({ isLoading: false, error: errorMessage });
        }
      },

      updateTasasCambio: async (tasasUpdates) => {
        try {
          const config = get().config;
          if (!config) throw new Error('Config not loaded');

          const updatedTasas = {
            ...config.tasasCambio,
            ...tasasUpdates,
            ultimaActualizacion: Timestamp.now()
          };

          await update(COLLECTIONS.CONFIG, CONFIG_DOC_ID, {
            tasasCambio: updatedTasas,
          });

          set((state) => ({
            config: state.config ? {
              ...state.config,
              tasasCambio: {
                ...state.config.tasasCambio,
                ...tasasUpdates,
                ultimaActualizacion: new Date()
              },
              updatedAt: new Date()
            } : null
          }));
        } catch (error) {
          console.error('Error updating tasas cambio:', error);
          throw error;
        }
      },

      updateDiasNotificacion: async (dias) => {
        try {
          const config = get().config;
          if (!config) throw new Error('Config not loaded');

          await update(COLLECTIONS.CONFIG, CONFIG_DOC_ID, {
            'notificaciones.diasAntes': dias,
          });

          set((state) => ({
            config: state.config ? {
              ...state.config,
              notificaciones: {
                ...state.config.notificaciones,
                diasAntes: dias
              },
              updatedAt: new Date()
            } : null
          }));
        } catch (error) {
          console.error('Error updating dias notificacion:', error);
          throw error;
        }
      },

      updateHoraEnvio: async (hora) => {
        try {
          const config = get().config;
          if (!config) throw new Error('Config not loaded');

          await update(COLLECTIONS.CONFIG, CONFIG_DOC_ID, {
            'notificaciones.horaEnvio': hora,
          });

          set((state) => ({
            config: state.config ? {
              ...state.config,
              notificaciones: {
                ...state.config.notificaciones,
                horaEnvio: hora
              },
              updatedAt: new Date()
            } : null
          }));
        } catch (error) {
          console.error('Error updating hora envio:', error);
          throw error;
        }
      },

      updatePrefijoWhatsApp: async (prefijo) => {
        try {
          const config = get().config;
          if (!config) throw new Error('Config not loaded');

          await update(COLLECTIONS.CONFIG, CONFIG_DOC_ID, {
            'whatsapp.prefijoTelefono': prefijo,
          });

          set((state) => ({
            config: state.config ? {
              ...state.config,
              whatsapp: {
                prefijoTelefono: prefijo
              },
              updatedAt: new Date()
            } : null
          }));
        } catch (error) {
          console.error('Error updating prefijo whatsapp:', error);
          throw error;
        }
      }
    }),
    { name: 'config-store' }
  )
);
