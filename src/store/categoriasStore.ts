import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Categoria } from '@/types';
import { getAll, getCount, create as createDoc, update, remove, COLLECTIONS, logCacheHit, queryDocuments } from '@/lib/firebase/firestore';
import { doc as firestoreDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Servicio, VentaDoc, PagoVenta, PagoServicio } from '@/types';
import { currencyService } from '@/lib/services/currencyService';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';

// Helper para obtener contexto de usuario
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

  // Counts for metrics (free queries)
  totalCategorias: number;
  categoriasClientes: number;
  categoriasRevendedores: number;

  // Actions
  fetchCategorias: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createCategoria: (categoria: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategoria: (id: string, updates: Partial<Categoria>) => Promise<void>;
  deleteCategoria: (id: string) => Promise<void>;
  setSelectedCategoria: (categoria: Categoria | null) => void;
  getCategoria: (id: string) => Categoria | undefined;
  getCategoriasByTipo: (tipo: 'cliente' | 'revendedor' | 'ambos') => Categoria[];
  resyncContadoresCategorias: (preFetchedData?: { servicios?: Servicio[]; ventas?: VentaDoc[]; pagosVenta?: PagoVenta[]; pagosServicio?: PagoServicio[] }) => Promise<{ categoriasCorregidas: number }>;
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
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.CATEGORIAS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const categorias = await getAll<Categoria>(COLLECTIONS.CATEGORIAS);
          set({ categorias, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar categorías';
          console.error('Error fetching categorias:', error);
          set({ categorias: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        try {
          const [totalCategorias, categoriasClientes, categoriasRevendedores] = await Promise.all([
            getCount(COLLECTIONS.CATEGORIAS, []),
            getCount(COLLECTIONS.CATEGORIAS, [{ field: 'tipo', operator: 'in', value: ['cliente', 'ambos'] }]),
            getCount(COLLECTIONS.CATEGORIAS, [{ field: 'tipo', operator: 'in', value: ['revendedor', 'ambos'] }]),
          ]);
          set({ totalCategorias, categoriasClientes, categoriasRevendedores });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalCategorias: 0, categoriasClientes: 0, categoriasRevendedores: 0 });
        }
      },

      createCategoria: async (categoriaData) => {
        try {
          // Inicializar contadores denormalizados en 0 para nueva categoría
          const categoriaConContadores = {
            ...categoriaData,
            totalServicios: 0,
            serviciosActivos: 0,
            perfilesDisponiblesTotal: 0,
            ventasTotales: 0,
            ingresosTotales: 0,
          };

          const id = await createDoc(COLLECTIONS.CATEGORIAS, categoriaConContadores as Omit<Categoria, 'id'>);

          const newCategoria: Categoria = {
            ...categoriaConContadores,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set((state) => ({
            categorias: [...state.categorias, newCategoria],
            error: null
          }));

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'categoria',
            entidadId: id,
            entidadNombre: categoriaData.nombre,
            detalles: `Categoría creada: "${categoriaData.nombre}"`,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear categoría';
          set({ error: errorMessage });
          console.error('Error creating categoria:', error);
          throw error;
        }
      },

      updateCategoria: async (id, updates) => {
        try {
          const oldCategoria = get().categorias.find(c => c.id === id);
          const cambioTipo = oldCategoria && updates.tipoCategoria && oldCategoria.tipoCategoria !== updates.tipoCategoria;

          await update(COLLECTIONS.CATEGORIAS, id, updates);

          // Detectar cambios para el log
          const cambios = oldCategoria ? detectarCambios('categoria', oldCategoria, {
            ...oldCategoria,
            ...updates
          }) : [];

          set((state) => {
            const updatedCategorias = state.categorias.map((cat) =>
              cat.id === id
                ? { ...cat, ...updates, updatedAt: new Date() }
                : cat
            );

            // Actualizar contadores si cambió el tipo
            let newCategoriasClientes = state.categoriasClientes;
            let newCategoriasRevendedores = state.categoriasRevendedores;

            if (cambioTipo && oldCategoria) {
              const oldTipo = oldCategoria.tipoCategoria;
              const newTipo = updates.tipoCategoria;

              // Decrementar contador del tipo anterior
              if (oldTipo === 'plataforma_streaming') {
                newCategoriasClientes--;
              } else if (oldTipo === 'otros') {
                newCategoriasRevendedores--;
              }

              // Incrementar contador del tipo nuevo
              if (newTipo === 'plataforma_streaming') {
                newCategoriasClientes++;
              } else if (newTipo === 'otros') {
                newCategoriasRevendedores++;
              }
            }

            return {
              categorias: updatedCategorias,
              categoriasClientes: newCategoriasClientes,
              categoriasRevendedores: newCategoriasRevendedores,
              error: null
            };
          });

          // Registrar en log de actividad con cambios
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'categoria',
            entidadId: id,
            entidadNombre: oldCategoria?.nombre ?? id,
            detalles: `Categoría actualizada: "${oldCategoria?.nombre}"`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar categoría';
          set({ error: errorMessage });
          console.error('Error updating categoria:', error);
          throw error;
        }
      },

      deleteCategoria: async (id) => {
        const currentCategorias = get().categorias;
        const categoriaEliminada = get().categorias.find(c => c.id === id);

        // Optimistic update
        set((state) => ({
          categorias: state.categorias.filter((cat) => cat.id !== id)
        }));

        try {
          await remove(COLLECTIONS.CATEGORIAS, id);

          // Notificar a otras páginas que se eliminó una categoría
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('categoria-deleted', Date.now().toString());
            window.dispatchEvent(new Event('categoria-deleted'));
          }

          set({ error: null });

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'categoria',
            entidadId: id,
            entidadNombre: categoriaEliminada?.nombre ?? id,
            detalles: `Categoría eliminada: "${categoriaEliminada?.nombre}"`,
          }).catch(() => {});
        } catch (error) {
          // Rollback on error
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar categoría';
          set({ categorias: currentCategorias, error: errorMessage });
          console.error('Error deleting categoria:', error);
          throw error;
        }
      },

      setSelectedCategoria: (categoria) => {
        set({ selectedCategoria: categoria });
      },

      getCategoria: (id) => {
        return get().categorias.find((cat) => cat.id === id);
      },

      getCategoriasByTipo: (tipo) => {
        return get().categorias.filter(
          (cat) => cat.tipo === tipo || cat.tipo === 'ambos'
        );
      },

      resyncContadoresCategorias: async (preFetchedData?: { 
        servicios?: Servicio[], 
        ventas?: VentaDoc[], 
        pagosVenta?: PagoVenta[], 
        pagosServicio?: PagoServicio[] 
      }) => {
        // 1. Cargar toda la data necesaria en paralelo (solo si no se provee)
        const [servicios, ventas, pagosVenta, pagosServicio] = preFetchedData 
          ? [
              preFetchedData.servicios || await getAll<Servicio>(COLLECTIONS.SERVICIOS),
              preFetchedData.ventas || await getAll<VentaDoc>(COLLECTIONS.VENTAS),
              preFetchedData.pagosVenta || await getAll<PagoVenta>(COLLECTIONS.PAGOS_VENTA),
              preFetchedData.pagosServicio || await queryDocuments<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO, []),
            ]
          : await Promise.all([
              getAll<Servicio>(COLLECTIONS.SERVICIOS),
              getAll<VentaDoc>(COLLECTIONS.VENTAS),
              getAll<PagoVenta>(COLLECTIONS.PAGOS_VENTA),
              queryDocuments<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO, []),
            ]);

        // 2. Agrupar por categoría
        const contadores = new Map<string, {
          totalServicios: number;
          serviciosActivos: number;
          ventasTotales: number;
          ingresosTotales: number;
          gastosTotal: number;
        }>();

        const getOrInit = (id: string) => {
          if (!contadores.has(id)) {
            contadores.set(id, { totalServicios: 0, serviciosActivos: 0, ventasTotales: 0, ingresosTotales: 0, gastosTotal: 0 });
          }
          return contadores.get(id)!;
        };

        // Servicios → totalServicios + serviciosActivos
        for (const s of servicios) {
          if (!s.categoriaId) continue;
          if (s.enReposo) continue;
          const c = getOrInit(s.categoriaId);
          c.totalServicios++;
          if (s.activo) c.serviciosActivos++;
        }

        // Ventas → ventasTotales (todas las que no sean inactivas)
        const ventasActivas = ventas.filter(v => v.estado !== 'inactivo');
        for (const v of ventasActivas) {
          if (!v.categoriaId) continue;
          getOrInit(v.categoriaId).ventasTotales++;
        }

        // PagosVenta → ingresosTotales (convertidos a USD)
        const pagosPorVenta = new Map<string, VentaDoc>();
        for (const v of ventas) pagosPorVenta.set(v.id, v);

        const ingresosConversiones = pagosVenta.map(async (p) => {
          const venta = pagosPorVenta.get(p.ventaId);
          if (!venta?.categoriaId) return;
          const moneda = p.moneda ?? 'USD';
          const usd = await currencyService.convertToUSD(p.monto, moneda);
          getOrInit(venta.categoriaId).ingresosTotales += usd;
        });
        await Promise.all(ingresosConversiones);

        // PagosServicio → gastosTotal (convertidos a USD)
        const serviciosPorId = new Map<string, Servicio>();
        for (const s of servicios) serviciosPorId.set(s.id, s);

        const gastosConversiones = pagosServicio.map(async (p) => {
          const servicio = serviciosPorId.get(p.servicioId);
          if (!servicio?.categoriaId) return;
          const moneda = p.moneda ?? 'USD';
          const usd = await currencyService.convertToUSD(p.monto, moneda);
          getOrInit(servicio.categoriaId).gastosTotal += usd;
        });
        await Promise.all(gastosConversiones);

        // 3. Escribir en Firestore (incluye categorías sin datos -> 0)
        const categoriasActuales = await getAll<Categoria>(COLLECTIONS.CATEGORIAS);
        let categoriasCorregidas = 0;
        const updates = categoriasActuales.map((categoria) => {
          const datos = contadores.get(categoria.id) ?? {
            totalServicios: 0,
            serviciosActivos: 0,
            ventasTotales: 0,
            ingresosTotales: 0,
            gastosTotal: 0,
          };

          const ingresosRedondeado = Math.round(datos.ingresosTotales * 100) / 100;
          const gastosRedondeado = Math.round(datos.gastosTotal * 100) / 100;
          const changed =
            (categoria.totalServicios ?? 0) !== datos.totalServicios ||
            (categoria.serviciosActivos ?? 0) !== datos.serviciosActivos ||
            (categoria.ventasTotales ?? 0) !== datos.ventasTotales ||
            Math.round((categoria.ingresosTotales ?? 0) * 100) / 100 !== ingresosRedondeado ||
            Math.round((categoria.gastosTotal ?? 0) * 100) / 100 !== gastosRedondeado;

          if (changed) categoriasCorregidas++;

          const ref = firestoreDoc(db, COLLECTIONS.CATEGORIAS, categoria.id);
          return updateDoc(ref, {
            totalServicios: datos.totalServicios,
            serviciosActivos: datos.serviciosActivos,
            ventasTotales: datos.ventasTotales,
            ingresosTotales: ingresosRedondeado,
            gastosTotal: gastosRedondeado,
          });
        });
        await Promise.all(updates);

        // 4. Refrescar store local
        await get().fetchCategorias(true);

        return { categoriasCorregidas };
      },
    }),
    { name: 'categorias-store' }
  )
);
