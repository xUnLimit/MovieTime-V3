import { ENTITIES, logCacheHit } from '@/lib/supabase/categorias-repository';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { supabase } from '@/lib/supabase/client';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import type { Categoria, Plan, TipoPlanConfig } from '@/types';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

interface CategoriasState {
  categorias: Categoria[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedCategoria: Categoria | null;

  totalCategorias: number;
  categoriasClientes: number;
  categoriasRevendedores: number;

  fetchCategorias: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createCategoria: (categoria: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategoria: (id: string, updates: Partial<Categoria>) => Promise<void>;
  deleteCategoria: (id: string) => Promise<void>;
  setSelectedCategoria: (categoria: Categoria | null) => void;
  getCategoria: (id: string) => Categoria | undefined;
  getCategoriasByTipo: (tipo: 'cliente' | 'revendedor' | 'ambos') => Categoria[];
  resyncContadoresCategorias: () => Promise<{ categoriasCorregidas: number }>;
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

export const useCategoriasStore = create<CategoriasState>()(
  devtools(
    (set, get) => ({
      categorias: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      selectedCategoria: null,
      totalCategorias: 0,
      categoriasClientes: 0,
      categoriasRevendedores: 0,

      fetchCategorias: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.CATEGORIAS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const categorias = await fetchCategoriasFull();
          set({ categorias, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar categorias';
          console.error('Error fetching categorias:', error);
          set({ categorias: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        try {
          const [{ count: totalCategorias }, { count: categoriasClientes }, { count: categoriasRevendedores }] =
            await Promise.all([
              supabase.from('categorias').select('*', { count: 'exact', head: true }),
              supabase.from('categorias').select('*', { count: 'exact', head: true }).in('tipo', ['cliente', 'ambos']),
              supabase.from('categorias').select('*', { count: 'exact', head: true }).in('tipo', ['revendedor', 'ambos']),
            ]);
          set({
            totalCategorias: totalCategorias ?? 0,
            categoriasClientes: categoriasClientes ?? 0,
            categoriasRevendedores: categoriasRevendedores ?? 0,
          });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalCategorias: 0, categoriasClientes: 0, categoriasRevendedores: 0 });
        }
      },

      createCategoria: async (categoriaData) => {
        try {
          const { data, error } = await supabase
            .from('categorias')
            .insert({
              nombre: categoriaData.nombre,
              tipo: categoriaData.tipo,
              tipo_categoria: categoriaData.tipoCategoria,
              notas: categoriaData.notas,
              activo: categoriaData.activo,
            })
            .select('*')
            .single();
          if (error) throw new Error(error.message);

          await upsertCategoriaPlanes(data.id, categoriaData.tiposPlanes ?? [], categoriaData.planes ?? []);
          const [newCategoria] = await buildCategorias([data]);

          set((state) => ({
            categorias: [...state.categorias, newCategoria],
            error: null,
          }));

          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'categoria',
            entidadId: data.id,
            entidadNombre: categoriaData.nombre,
            detalles: `Categoria creada: "${categoriaData.nombre}"`,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear categoria';
          set({ error: errorMessage });
          console.error('Error creating categoria:', error);
          throw error;
        }
      },

      updateCategoria: async (id, updates) => {
        try {
          const oldCategoria = get().categorias.find((categoria) => categoria.id === id);
          const { data, error } = await supabase
            .from('categorias')
            .update({
              ...(updates.nombre !== undefined ? { nombre: updates.nombre } : {}),
              ...(updates.tipo !== undefined ? { tipo: updates.tipo } : {}),
              ...(updates.tipoCategoria !== undefined ? { tipo_categoria: updates.tipoCategoria } : {}),
              ...(updates.notas !== undefined ? { notas: updates.notas } : {}),
              ...(updates.activo !== undefined ? { activo: updates.activo } : {}),
            })
            .eq('id', id)
            .select('*')
            .single();
          if (error) throw new Error(error.message);

          if (updates.tiposPlanes || updates.planes) {
            await upsertCategoriaPlanes(
              id,
              updates.tiposPlanes ?? oldCategoria?.tiposPlanes ?? [],
              updates.planes ?? oldCategoria?.planes ?? []
            );
          }

          const [updatedCategoria] = await buildCategorias([data]);
          const cambios = oldCategoria
            ? detectarCambios(
                'categoria',
                oldCategoria as unknown as Record<string, unknown>,
                updatedCategoria as unknown as Record<string, unknown>
              )
            : [];

          set((state) => ({
            categorias: state.categorias.map((categoria) =>
              categoria.id === id ? updatedCategoria : categoria
            ),
            error: null,
          }));

          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'categoria',
            entidadId: id,
            entidadNombre: oldCategoria?.nombre ?? id,
            detalles: `Categoria actualizada: "${oldCategoria?.nombre}"`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar categoria';
          set({ error: errorMessage });
          console.error('Error updating categoria:', error);
          throw error;
        }
      },

      deleteCategoria: async (id) => {
        const currentCategorias = get().categorias;
        const categoriaEliminada = currentCategorias.find((categoria) => categoria.id === id);
        set((state) => ({ categorias: state.categorias.filter((categoria) => categoria.id !== id) }));

        try {
          const { error } = await supabase.from('categorias').delete().eq('id', id);
          if (error) throw new Error(error.message);

          if (typeof window !== 'undefined') {
            window.localStorage.setItem('categoria-deleted', Date.now().toString());
            window.dispatchEvent(new Event('categoria-deleted'));
          }

          set({ error: null });
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'categoria',
            entidadId: id,
            entidadNombre: categoriaEliminada?.nombre ?? id,
            detalles: `Categoria eliminada: "${categoriaEliminada?.nombre}"`,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar categoria';
          set({ categorias: currentCategorias, error: errorMessage });
          console.error('Error deleting categoria:', error);
          throw error;
        }
      },

      setSelectedCategoria: (categoria) => set({ selectedCategoria: categoria }),

      getCategoria: (id) => get().categorias.find((categoria) => categoria.id === id),

      getCategoriasByTipo: (tipo) =>
        get().categorias.filter((categoria) => categoria.tipo === tipo || categoria.tipo === 'ambos'),

      resyncContadoresCategorias: async () => {
        // Category counters are derived by v_categoria_counters; a refetch is all that is needed.
        await get().fetchCategorias(true);
        return { categoriasCorregidas: 0 };
      },
    }),
    { name: 'categorias-store' }
  )
);

async function fetchCategoriasFull(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('*').order('nombre');
  if (error) throw new Error(error.message);
  return buildCategorias(data ?? []);
}

async function buildCategorias(
  categoriasRows: {
    id: string;
    nombre: string;
    tipo: 'cliente' | 'revendedor' | 'ambos';
    tipo_categoria: 'plataforma_streaming' | 'otros' | null;
    notas: string | null;
    activo: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
  }[]
): Promise<Categoria[]> {
  const ids = categoriasRows.map((categoria) => categoria.id);
  if (ids.length === 0) return [];

  const [
    tiposResult,
    planesResult,
    countersResult,
    ventasResult,
    financialResult,
  ] = await Promise.all([
    supabase.from('planes_tipos').select('*').in('categoria_id', ids),
    supabase.from('planes').select('*').in('categoria_id', ids),
    supabase.from('v_categoria_counters').select('*').in('categoria_id', ids),
    supabase.from('v_ventas_full').select('categoria_id,estado').in('categoria_id', ids),
    supabase.from('v_categoria_financial_metrics').select('*').in('categoria_id', ids),
  ]);

  if (tiposResult.error) throw new Error(tiposResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);
  if (countersResult.error) throw new Error(countersResult.error.message);
  if (ventasResult.error) throw new Error(ventasResult.error.message);
  if (financialResult.error) throw new Error(financialResult.error.message);

  const tiposByCategoria = new Map<string, TipoPlanConfig[]>();
  for (const tipo of tiposResult.data ?? []) {
    tiposByCategoria.set(tipo.categoria_id, [
      ...(tiposByCategoria.get(tipo.categoria_id) ?? []),
      { id: tipo.id, nombre: tipo.nombre },
    ]);
  }

  const planesByCategoria = new Map<string, Plan[]>();
  for (const plan of planesResult.data ?? []) {
    planesByCategoria.set(plan.categoria_id, [
      ...(planesByCategoria.get(plan.categoria_id) ?? []),
      {
        id: plan.id,
        nombre: plan.nombre,
        precio: Number(plan.precio),
        cicloPago: plan.ciclo_pago,
        tipoPlan: plan.plan_tipo_id,
      },
    ]);
  }

  const countersByCategoria = new Map(
    (countersResult.data ?? []).map((counter) => [counter.categoria_id, counter])
  );
  const ventasActivasByCategoria = new Map<string, number>();
  for (const venta of ventasResult.data ?? []) {
    if (!venta.categoria_id || venta.estado === 'inactivo') continue;
    ventasActivasByCategoria.set(
      venta.categoria_id,
      (ventasActivasByCategoria.get(venta.categoria_id) ?? 0) + 1
    );
  }

  const financialByCategoria = new Map(
    (financialResult.data ?? []).map((row) => [row.categoria_id, row])
  );

  return categoriasRows.map((categoria) => {
    const counters = countersByCategoria.get(categoria.id);
    const financial = financialByCategoria.get(categoria.id);
    return {
      id: categoria.id,
      nombre: categoria.nombre,
      tipo: categoria.tipo,
      tipoCategoria: categoria.tipo_categoria ?? undefined,
      tiposPlanes: tiposByCategoria.get(categoria.id) ?? [],
      planes: planesByCategoria.get(categoria.id) ?? [],
      notas: categoria.notas ?? undefined,
      activo: categoria.activo,
      totalServicios: Number(counters?.total_servicios ?? 0),
      serviciosActivos: Number(counters?.servicios_activos ?? 0),
      perfilesDisponiblesTotal: Number(counters?.perfiles_disponibles_total ?? 0),
      ventasTotales: ventasActivasByCategoria.get(categoria.id) ?? 0,
      ingresosTotales: Number(financial?.ingresos_usd ?? 0),
      gastosTotal: Number(financial?.gastos_usd ?? 0),
      createdAt: new Date(categoria.created_at),
      updatedAt: new Date(categoria.updated_at),
      createdBy: categoria.created_by ?? undefined,
    };
  });
}

async function upsertCategoriaPlanes(
  categoriaId: string,
  tiposPlanes: TipoPlanConfig[],
  planes: Plan[]
) {
  if (tiposPlanes.length > 0) {
    const { error } = await supabase.from('planes_tipos').upsert(
      tiposPlanes.map((tipo, index) => ({
        id: tipo.id,
        categoria_id: categoriaId,
        nombre: tipo.nombre,
        orden: index + 1,
        activo: true,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(error.message);
  }

  if (planes.length > 0) {
    const { error } = await supabase.from('planes').upsert(
      planes.map((plan, index) => ({
        id: plan.id,
        categoria_id: categoriaId,
        plan_tipo_id: plan.tipoPlan,
        nombre: plan.nombre,
        precio: plan.precio,
        ciclo_pago: plan.cicloPago,
        orden: index + 1,
        activo: true,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(error.message);
  }
}
