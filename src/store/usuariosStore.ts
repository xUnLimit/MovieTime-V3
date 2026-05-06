import { startOfDay } from 'date-fns';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { ENTITIES, getUsuarios, logCacheHit } from '@/lib/supabase/usuarios-repository';
import {
  createUsuarioUseCase,
  deleteUsuarioUseCase,
  fetchUsuariosCountsUseCase,
  resolveUsuarioForDelete,
  updateUsuarioUseCase,
} from '@/lib/use-cases/usuarios-use-cases';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { Usuario } from '@/types';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

function dispatchUsuarioEvent(name: 'usuario-deleted' | 'usuario-nombre-updated') {
  if (typeof window === 'undefined') return;
  if (name === 'usuario-deleted') {
    window.localStorage.setItem(name, Date.now().toString());
  }
  window.dispatchEvent(new Event(name));
}

interface UsuariosState {
  usuarios: Usuario[];
  totalClientes: number;
  totalRevendedores: number;
  totalNuevosHoy: number;
  totalUsuariosActivos: number;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  lastCountsFetch: number | null;
  selectedUsuario: Usuario | null;

  fetchUsuarios: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  resyncServiciosActivos: () => Promise<{ usuariosReparados: number }>;
  createUsuario: (usuario: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos' | 'suscripcionesTotales'>) => Promise<void>;
  updateUsuario: (id: string, updates: Partial<Usuario>) => Promise<void>;
  deleteUsuario: (id: string, usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number }) => Promise<void>;
  setSelectedUsuario: (usuario: Usuario | null) => void;
  getUsuario: (id: string) => Usuario | undefined;
  getClientes: () => Usuario[];
  getRevendedores: () => Usuario[];
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

export const useUsuariosStore = create<UsuariosState>()(
  devtools(
    (set, get) => ({
      usuarios: [],
      totalClientes: 0,
      totalRevendedores: 0,
      totalNuevosHoy: 0,
      totalUsuariosActivos: 0,
      isLoading: false,
      error: null,
      lastFetch: null,
      lastCountsFetch: null,
      selectedUsuario: null,

      fetchUsuarios: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.USUARIOS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const usuarios = await getUsuarios<Usuario>();
          set({ usuarios, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar usuarios';
          console.error('Error fetching usuarios:', error);
          set({ usuarios: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        const { lastCountsFetch } = get();
        if (lastCountsFetch && Date.now() - lastCountsFetch < CACHE_TIMEOUT) {
          logCacheHit('usuarios-counts');
          return;
        }

        try {
          set({
            ...(await fetchUsuariosCountsUseCase()),
            lastCountsFetch: Date.now(),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al cargar conteos';
          set({ error: errorMessage });
          console.error('Error fetching counts:', error);
        }
      },

      resyncServiciosActivos: async () => {
        await get().fetchUsuarios(true);
        return { usuariosReparados: 0 };
      },

      createUsuario: async (usuarioData) => {
        try {
          const usuario = await createUsuarioUseCase(usuarioData, {
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            usuarios: [...state.usuarios, usuario],
            totalClientes: usuarioData.tipo === 'cliente' ? state.totalClientes + 1 : state.totalClientes,
            totalRevendedores: usuarioData.tipo === 'revendedor' ? state.totalRevendedores + 1 : state.totalRevendedores,
            totalNuevosHoy: state.totalNuevosHoy + 1,
            error: null,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear usuario';
          set({ error: errorMessage });
          console.error('Error creating usuario:', error);
          throw error;
        }
      },

      updateUsuario: async (id, updates) => {
        try {
          const oldUsuario = get().usuarios.find((usuario) => usuario.id === id);
          const cambioTipo = oldUsuario && updates.tipo && oldUsuario.tipo !== updates.tipo;
          const cambioServiciosActivos =
            oldUsuario && updates.serviciosActivos !== undefined && oldUsuario.serviciosActivos !== updates.serviciosActivos;

          const { shouldRefreshNotificaciones, shouldDispatchUsuarioNombreUpdated } = await updateUsuarioUseCase(id, updates, {
            oldUsuario,
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          if (shouldRefreshNotificaciones) {
            const { useNotificacionesStore } = await import('@/store/notificacionesStore');
            await useNotificacionesStore.getState().fetchNotificaciones(true);
          }

          if (shouldDispatchUsuarioNombreUpdated) {
            dispatchUsuarioEvent('usuario-nombre-updated');
          }

          set((state) => {
            const updatedUsuarios = state.usuarios.map((usuario) =>
              usuario.id === id ? { ...usuario, ...updates, updatedAt: new Date() } : usuario
            );

            let newTotalClientes = state.totalClientes;
            let newTotalRevendedores = state.totalRevendedores;
            let newTotalUsuariosActivos = state.totalUsuariosActivos;

            if (cambioTipo && oldUsuario) {
              if (oldUsuario.tipo === 'cliente' && updates.tipo === 'revendedor') {
                newTotalClientes--;
                newTotalRevendedores++;
              } else if (oldUsuario.tipo === 'revendedor' && updates.tipo === 'cliente') {
                newTotalClientes++;
                newTotalRevendedores--;
              }
            }

            if (cambioServiciosActivos && oldUsuario) {
              const oldActivo = (oldUsuario.serviciosActivos ?? 0) > 0;
              const newActivo = (updates.serviciosActivos ?? 0) > 0;

              if (oldActivo && !newActivo) {
                newTotalUsuariosActivos--;
              } else if (!oldActivo && newActivo) {
                newTotalUsuariosActivos++;
              }
            }

            return {
              usuarios: updatedUsuarios,
              totalClientes: newTotalClientes,
              totalRevendedores: newTotalRevendedores,
              totalUsuariosActivos: newTotalUsuariosActivos,
              error: null,
            };
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar usuario';
          set({ error: errorMessage });
          console.error('Error updating usuario:', error);
          throw error;
        }
      },

      deleteUsuario: async (id, usuarioData) => {
        const currentUsuarios = get().usuarios;
        const deletedUser = await resolveUsuarioForDelete(
          id,
          usuarioData,
          currentUsuarios.find((usuario) => usuario.id === id)
        );

        const today = startOfDay(new Date());
        const wasCreatedToday =
          deletedUser.createdAt && startOfDay(new Date(deletedUser.createdAt)).getTime() === today.getTime();
        const wasActive = (deletedUser.serviciosActivos ?? 0) > 0;
        const currentState = {
          totalClientes: get().totalClientes,
          totalRevendedores: get().totalRevendedores,
          totalNuevosHoy: get().totalNuevosHoy,
          totalUsuariosActivos: get().totalUsuariosActivos,
          usuarios: currentUsuarios,
        };

        set((state) => ({
          usuarios: state.usuarios.filter((usuario) => usuario.id !== id),
          totalClientes: deletedUser.tipo === 'cliente' ? state.totalClientes - 1 : state.totalClientes,
          totalRevendedores: deletedUser.tipo === 'revendedor' ? state.totalRevendedores - 1 : state.totalRevendedores,
          totalNuevosHoy: wasCreatedToday ? state.totalNuevosHoy - 1 : state.totalNuevosHoy,
          totalUsuariosActivos: wasActive ? state.totalUsuariosActivos - 1 : state.totalUsuariosActivos,
        }));

        try {
          await deleteUsuarioUseCase(id, deletedUser, {
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          dispatchUsuarioEvent('usuario-deleted');
          set({ error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar usuario';
          set({
            usuarios: currentState.usuarios,
            totalClientes: currentState.totalClientes,
            totalRevendedores: currentState.totalRevendedores,
            totalNuevosHoy: currentState.totalNuevosHoy,
            totalUsuariosActivos: currentState.totalUsuariosActivos,
            error: errorMessage,
          });
          console.error('Error deleting usuario:', error);
          throw error;
        }
      },

      setSelectedUsuario: (usuario) => {
        set({ selectedUsuario: usuario });
      },

      getUsuario: (id) => {
        return get().usuarios.find((usuario) => usuario.id === id);
      },

      getClientes: () => {
        return get().usuarios.filter((usuario) => usuario.tipo === 'cliente');
      },

      getRevendedores: () => {
        return get().usuarios.filter((usuario) => usuario.tipo === 'revendedor');
      },
    }),
    { name: 'usuarios-store' }
  )
);
