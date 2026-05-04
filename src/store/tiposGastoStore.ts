import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Gasto, TipoGasto } from '@/types';
import {
  COLLECTIONS,
  create as createDoc,
  getAll,
  getCount,
  logCacheHit,
  queryDocuments,
  update,
} from '@/lib/firebase/firestore';

const CACHE_TIMEOUT = 5 * 60 * 1000;

function sortTiposGasto(tiposGasto: TipoGasto[]) {
  return [...tiposGasto].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

interface TiposGastoState {
  tiposGasto: TipoGasto[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  totalTipos: number;
  tiposActivos: number;
  fetchTiposGasto: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createTipoGasto: (tipoGasto: Omit<TipoGasto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTipoGasto: (id: string, updates: Partial<TipoGasto>) => Promise<void>;
  toggleActivo: (id: string) => Promise<void>;
  getTipoGasto: (id: string) => TipoGasto | undefined;
  getTiposActivos: () => TipoGasto[];
}

export const useTiposGastoStore = create<TiposGastoState>()(
  devtools(
    (set, get) => ({
      tiposGasto: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      totalTipos: 0,
      tiposActivos: 0,

      fetchTiposGasto: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.TIPOS_GASTO);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const tiposGasto = await getAll<TipoGasto>(COLLECTIONS.TIPOS_GASTO);
          set({
            tiposGasto: sortTiposGasto(tiposGasto),
            isLoading: false,
            error: null,
            lastFetch: Date.now(),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al cargar tipos de gasto';
          console.error('Error fetching tipos de gasto:', error);
          set({ tiposGasto: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        try {
          const [totalTipos, tiposActivos] = await Promise.all([
            getCount(COLLECTIONS.TIPOS_GASTO, []),
            getCount(COLLECTIONS.TIPOS_GASTO, [{ field: 'activo', operator: '==', value: true }]),
          ]);
          set({ totalTipos, tiposActivos });
        } catch (error) {
          console.error('Error fetching tipos de gasto counts:', error);
          set({ totalTipos: 0, tiposActivos: 0 });
        }
      },

      createTipoGasto: async (tipoGastoData) => {
        const normalizedNombre = tipoGastoData.nombre.trim();
        if (!normalizedNombre) {
          throw new Error('El nombre del tipo de gasto es obligatorio');
        }

        const existing = get().tiposGasto.find(
          (tipo) => tipo.nombre.trim().toLowerCase() === normalizedNombre.toLowerCase()
        );
        if (existing) {
          throw new Error('Ya existe un tipo de gasto con ese nombre');
        }

        const id = await createDoc(COLLECTIONS.TIPOS_GASTO, {
          ...tipoGastoData,
          nombre: normalizedNombre,
        } as Omit<TipoGasto, 'id'>);

        const newTipoGasto: TipoGasto = {
          ...tipoGastoData,
          nombre: normalizedNombre,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          tiposGasto: sortTiposGasto([...state.tiposGasto, newTipoGasto]),
          totalTipos: state.totalTipos + 1,
          tiposActivos: state.tiposActivos + (newTipoGasto.activo ? 1 : 0),
        }));
      },

      updateTipoGasto: async (id, updates) => {
        const tipoActual = get().tiposGasto.find((tipo) => tipo.id === id);
        if (!tipoActual) throw new Error('Tipo de gasto no encontrado');

        const normalizedNombre = updates.nombre?.trim();
        if (normalizedNombre !== undefined && !normalizedNombre) {
          throw new Error('El nombre del tipo de gasto es obligatorio');
        }

        if (normalizedNombre && normalizedNombre.toLowerCase() !== tipoActual.nombre.trim().toLowerCase()) {
          const existing = get().tiposGasto.find(
            (tipo) => tipo.id !== id && tipo.nombre.trim().toLowerCase() === normalizedNombre.toLowerCase()
          );
          if (existing) {
            throw new Error('Ya existe un tipo de gasto con ese nombre');
          }
        }

        const finalUpdates: Partial<TipoGasto> = {
          ...updates,
          ...(normalizedNombre !== undefined ? { nombre: normalizedNombre } : {}),
        };

        await update(COLLECTIONS.TIPOS_GASTO, id, finalUpdates);

        if (finalUpdates.nombre && finalUpdates.nombre !== tipoActual.nombre) {
          const gastosRelacionados = await queryDocuments<Gasto>(COLLECTIONS.GASTOS, [
            { field: 'tipoGastoId', operator: '==', value: id },
          ]);

          await Promise.all(
            gastosRelacionados.map((gasto) =>
              update(COLLECTIONS.GASTOS, gasto.id, { tipoGastoNombre: finalUpdates.nombre })
            )
          );

          import('./gastosStore')
            .then(({ useGastosStore }) => {
              useGastosStore.setState((state) => ({
                gastos: state.gastos.map((gasto) =>
                  gasto.tipoGastoId === id
                    ? { ...gasto, tipoGastoNombre: finalUpdates.nombre!, updatedAt: new Date() }
                    : gasto
                ),
              }));
            })
            .catch(() => {});
        }

        set((state) => {
          const tiposGasto = state.tiposGasto.map((tipo) =>
            tipo.id === id
              ? { ...tipo, ...finalUpdates, updatedAt: new Date() }
              : tipo
          );

          const previousActivo = tipoActual.activo;
          const nextActivo = finalUpdates.activo ?? tipoActual.activo;

          return {
            tiposGasto: sortTiposGasto(tiposGasto),
            tiposActivos:
              state.tiposActivos +
              (previousActivo === nextActivo ? 0 : nextActivo ? 1 : -1),
          };
        });
      },

      toggleActivo: async (id) => {
        const tipo = get().tiposGasto.find((item) => item.id === id);
        if (!tipo) throw new Error('Tipo de gasto no encontrado');
        await get().updateTipoGasto(id, { activo: !tipo.activo });
      },

      getTipoGasto: (id) => get().tiposGasto.find((tipo) => tipo.id === id),

      getTiposActivos: () => get().tiposGasto.filter((tipo) => tipo.activo),
    }),
    { name: 'tipos-gasto-store' }
  )
);
