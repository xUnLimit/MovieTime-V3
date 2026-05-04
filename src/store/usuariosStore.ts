import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { startOfDay, format } from 'date-fns';
import { Usuario, VentaDoc } from '@/types';
import { getAll, getCount, getById, create as createDoc, update, remove, queryDocuments, COLLECTIONS, logCacheHit } from '@/lib/firebase/firestore';
import { adjustUsuariosPorMes, getDiaKeyFromDate } from '@/lib/services/dashboardStatsService';
import { sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
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

  // Actions
  fetchUsuarios: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  resyncServiciosActivos: (preFetchedData?: { usuarios?: Usuario[]; ventas?: VentaDoc[] }) => Promise<{ usuariosReparados: number }>;
  createUsuario: (usuario: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos' | 'suscripcionesTotales'>) => Promise<void>;
  updateUsuario: (id: string, updates: Partial<Usuario>) => Promise<void>;
  deleteUsuario: (id: string, usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number }) => Promise<void>;
  setSelectedUsuario: (usuario: Usuario | null) => void;
  getUsuario: (id: string) => Usuario | undefined;
  getClientes: () => Usuario[];
  getRevendedores: () => Usuario[];
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

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

      // Trae todos los docs — para páginas de detalle/edición
      fetchUsuarios: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.USUARIOS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const usuarios = await getAll<Usuario>(COLLECTIONS.USUARIOS);
          set({ usuarios, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar usuarios';
          console.error('Error fetching usuarios:', error);
          set({ usuarios: [], isLoading: false, error: errorMessage });
        }
      },

      // Solo conteos — para widgets (3 lecturas totales)
      fetchCounts: async () => {
        const { lastCountsFetch } = get();
        if (lastCountsFetch && (Date.now() - lastCountsFetch) < CACHE_TIMEOUT) {
          logCacheHit('usuarios-counts');
          return;
        }

        try {
          const today = startOfDay(new Date());
          const [totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos] = await Promise.all([
            getCount(COLLECTIONS.USUARIOS, [{ field: 'tipo', operator: '==', value: 'cliente' }]),
            getCount(COLLECTIONS.USUARIOS, [{ field: 'tipo', operator: '==', value: 'revendedor' }]),
            getCount(COLLECTIONS.USUARIOS, [{ field: 'createdAt', operator: '>=', value: today }]),
            getCount(COLLECTIONS.USUARIOS, [{ field: 'serviciosActivos', operator: '>', value: 0 }]),
          ]);
          set({ totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos, lastCountsFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al cargar conteos';
          set({ error: errorMessage });
          console.error('Error fetching counts:', error);
        }
      },

      resyncServiciosActivos: async (preFetchedData?: { usuarios?: Usuario[], ventas?: VentaDoc[] }) => {
        try {
          const [usuarios, ventas] = preFetchedData 
            ? [
                preFetchedData.usuarios || await getAll<Usuario>(COLLECTIONS.USUARIOS),
                preFetchedData.ventas || await getAll<VentaDoc>(COLLECTIONS.VENTAS)
              ]
            : await Promise.all([
                getAll<Usuario>(COLLECTIONS.USUARIOS),
                getAll<VentaDoc>(COLLECTIONS.VENTAS),
              ]);

          const conteoVentasActivas = new Map<string, number>();

          for (const venta of ventas) {
            const clienteId = venta.clienteId;
            const estaActiva = (venta.estado ?? 'activo') !== 'inactivo';

            if (!clienteId || !estaActiva) {
              continue;
            }

            conteoVentasActivas.set(clienteId, (conteoVentasActivas.get(clienteId) ?? 0) + 1);
          }

          const usuariosSincronizados = usuarios.map((usuario) => ({
            ...usuario,
            serviciosActivos: conteoVentasActivas.get(usuario.id) ?? 0,
          }));
          const serviciosActivosActuales = new Map(
            usuarios.map((usuario) => [usuario.id, usuario.serviciosActivos ?? 0])
          );

          const usuariosDesfasados = usuariosSincronizados.filter(
            (usuario) => serviciosActivosActuales.get(usuario.id) !== usuario.serviciosActivos
          );

          await Promise.all(
            usuariosDesfasados.map((usuario) =>
              update(COLLECTIONS.USUARIOS, usuario.id, { serviciosActivos: usuario.serviciosActivos })
            )
          );

          set((state) => {
            const selectedUsuario = state.selectedUsuario
              ? usuariosSincronizados.find((usuario) => usuario.id === state.selectedUsuario?.id) ?? null
              : null;

            return {
              usuarios: usuariosSincronizados,
              totalClientes: usuariosSincronizados.filter((usuario) => usuario.tipo === 'cliente').length,
              totalRevendedores: usuariosSincronizados.filter((usuario) => usuario.tipo === 'revendedor').length,
              totalUsuariosActivos: usuariosSincronizados.filter((usuario) => (usuario.serviciosActivos ?? 0) > 0).length,
              selectedUsuario,
              error: null,
              lastFetch: Date.now(),
              lastCountsFetch: Date.now(),
            };
          });

          return { usuariosReparados: usuariosDesfasados.length };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al resincronizar servicios activos';
          set({ error: errorMessage });
          console.error('[UsuariosStore] Error resyncing serviciosActivos:', error);
          throw error;
        }
      },

      createUsuario: async (usuarioData) => {
        try {
          const id = await createDoc(COLLECTIONS.USUARIOS, {
            ...usuarioData,
            serviciosActivos: 0,
            active: true,
          });

          const newUsuario: Usuario = {
            ...usuarioData,
            id,
            serviciosActivos: 0,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: ''
          };

          set((state) => ({
            usuarios: [...state.usuarios, newUsuario],
            totalClientes: usuarioData.tipo === 'cliente' ? state.totalClientes + 1 : state.totalClientes,
            totalRevendedores: usuarioData.tipo === 'revendedor' ? state.totalRevendedores + 1 : state.totalRevendedores,
            totalNuevosHoy: state.totalNuevosHoy + 1,
            error: null
          }));

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: usuarioData.tipo === 'cliente' ? 'cliente' : 'revendedor',
            entidadId: id,
            entidadNombre: usuarioData.nombre,
            detalles: `${usuarioData.tipo === 'cliente' ? 'Cliente' : 'Revendedor'} creado: "${usuarioData.nombre}"`,
          }).catch(() => {});

          // Actualizar estadísticas del dashboard (non-blocking)
          adjustUsuariosPorMes({
            mes: format(new Date(), 'yyyy-MM'),
            dia: getDiaKeyFromDate(new Date()),
            tipo: usuarioData.tipo,
            delta: 1,
          }).catch((err) => console.error('[UsuariosStore] Error updating dashboard stats:', err));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear usuario';
          set({ error: errorMessage });
          console.error('Error creating usuario:', error);
          throw error;
        }
      },

      updateUsuario: async (id, updates) => {
        try {
          const oldUsuario = get().usuarios.find(u => u.id === id);
          const cambioTipo = oldUsuario && updates.tipo && oldUsuario.tipo !== updates.tipo;
          const cambioServiciosActivos = oldUsuario && updates.serviciosActivos !== undefined && oldUsuario.serviciosActivos !== updates.serviciosActivos;
          const nombreChanged = oldUsuario
            ? updates.nombre !== undefined || updates.apellido !== undefined
            : false;
          const telefonoChanged = oldUsuario
            ? updates.telefono !== undefined && updates.telefono !== oldUsuario.telefono
            : false;

          await update(COLLECTIONS.USUARIOS, id, updates);

          // Si cambió nombre o teléfono, sincronizar campos denormalizados en ventas
          // y refrescar notificaciones derivadas de esas ventas antes de resolver el guardado.
          if ((nombreChanged || telefonoChanged) && oldUsuario) {
            const nuevoNombre = `${updates.nombre ?? oldUsuario.nombre} ${updates.apellido ?? oldUsuario.apellido}`;
            const nuevoTelefono = updates.telefono ?? oldUsuario.telefono;
            const [ventasDelCliente, pagosDelCliente] = await Promise.all([
              queryDocuments<{ id: string }>(COLLECTIONS.VENTAS, [{ field: 'clienteId', operator: '==', value: id }]),
              nombreChanged
                ? queryDocuments<{ id: string }>(COLLECTIONS.PAGOS_VENTA, [{ field: 'clienteId', operator: '==', value: id }])
                : Promise.resolve([] as { id: string }[]),
            ]);
            const ventaUpdates: Record<string, unknown> = {};

            if (nombreChanged) {
              ventaUpdates.clienteNombre = nuevoNombre;
            }

            if (telefonoChanged) {
              ventaUpdates.clienteTelefono = nuevoTelefono;
            }

            await Promise.all([
              ...ventasDelCliente.map(v => update(COLLECTIONS.VENTAS, v.id, ventaUpdates)),
              ...pagosDelCliente.map(p => update(COLLECTIONS.PAGOS_VENTA, p.id, { clienteNombre: nuevoNombre })),
            ]);

            if (ventasDelCliente.length > 0) {
              await sincronizarNotificacionesForzado();
              const { useNotificacionesStore } = await import('@/store/notificacionesStore');
              await useNotificacionesStore.getState().fetchNotificaciones(true);
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('usuario-nombre-updated'));
            }
          }

          set((state) => {
            const updatedUsuarios = state.usuarios.map((usuario) =>
              usuario.id === id
                ? { ...usuario, ...updates, updatedAt: new Date() }
                : usuario
            );

            // Actualizar contadores si hubo cambio de tipo
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

            // Actualizar contador de usuarios activos si cambió serviciosActivos
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
              error: null
            };
          });

          // Detectar cambios para el log
          const entidadTipo = (oldUsuario?.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor';
          const cambios = oldUsuario ? detectarCambios(entidadTipo, oldUsuario, {
            ...oldUsuario,
            ...updates
          }) : [];

          // Registrar en log de actividad con cambios
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: entidadTipo,
            entidadId: id,
            entidadNombre: oldUsuario?.nombre ?? id,
            detalles: `Usuario actualizado: "${oldUsuario?.nombre}"`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar usuario';
          set({ error: errorMessage });
          console.error('Error updating usuario:', error);
          throw error;
        }
      },

      deleteUsuario: async (id, usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number }) => {
        // Si se proporciona usuarioData, usarlo; de lo contrario, buscar en usuarios locales o en Firebase
        let deletedUser: Usuario | undefined;

        if (usuarioData) {
          // Crear un objeto Usuario mínimo con los datos proporcionados
          deletedUser = { ...usuarioData } as Usuario;
        } else {
          // Intentar buscar en el store local (puede estar vacío con paginación)
          const currentUsuarios = get().usuarios;
          deletedUser = currentUsuarios.find(u => u.id === id);

          if (!deletedUser) {
            // Si no está en el store local, traerlo de Firebase
            try {
              const fetchedUser = await getById<Usuario>(COLLECTIONS.USUARIOS, id);
              if (!fetchedUser) {
                throw new Error('Usuario no encontrado en Firebase');
              }
              deletedUser = fetchedUser;
            } catch (error) {
              console.error('Error fetching usuario from Firebase:', error);
              throw new Error('Usuario no encontrado');
            }
          }
        }

        if (!deletedUser) {
          throw new Error('Usuario no encontrado');
        }

        const today = startOfDay(new Date());
        const wasCreatedToday = deletedUser.createdAt && startOfDay(new Date(deletedUser.createdAt)).getTime() === today.getTime();
        const wasActive = (deletedUser.serviciosActivos ?? 0) > 0;

        // Guardar estado actual para rollback
        const currentState = {
          totalClientes: get().totalClientes,
          totalRevendedores: get().totalRevendedores,
          totalNuevosHoy: get().totalNuevosHoy,
          totalUsuariosActivos: get().totalUsuariosActivos,
          usuarios: get().usuarios,
        };

        // Optimistic update de contadores
        set((state) => ({
          usuarios: state.usuarios.filter((usuario) => usuario.id !== id), // Solo si está en memoria
          totalClientes: deletedUser!.tipo === 'cliente' ? state.totalClientes - 1 : state.totalClientes,
          totalRevendedores: deletedUser!.tipo === 'revendedor' ? state.totalRevendedores - 1 : state.totalRevendedores,
          totalNuevosHoy: wasCreatedToday ? state.totalNuevosHoy - 1 : state.totalNuevosHoy,
          totalUsuariosActivos: wasActive ? state.totalUsuariosActivos - 1 : state.totalUsuariosActivos,
        }));

        try {
          await remove(COLLECTIONS.USUARIOS, id);

          // Notificar a otras páginas que se eliminó un usuario
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('usuario-deleted', Date.now().toString());
            window.dispatchEvent(new Event('usuario-deleted'));
          }

          set({ error: null });

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: (deletedUser?.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor',
            entidadId: id,
            entidadNombre: deletedUser?.nombre ?? id,
            detalles: `Usuario eliminado: "${deletedUser?.nombre}"`,
          }).catch(() => {});

          // Restar de estadísticas del dashboard (non-blocking)
          if (deletedUser?.createdAt) {
            adjustUsuariosPorMes({
              mes: format(new Date(deletedUser.createdAt), 'yyyy-MM'),
              dia: getDiaKeyFromDate(new Date(deletedUser.createdAt)),
              tipo: deletedUser.tipo,
              delta: -1,
            }).catch((err) => console.error('[UsuariosStore] Error reverting dashboard stats:', err));
          }
        } catch (error) {
          // Rollback on error - restaurar estado anterior completo
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
        return get().usuarios.filter(u => u.tipo === 'cliente');
      },

      getRevendedores: () => {
        return get().usuarios.filter(u => u.tipo === 'revendedor');
      }
    }),
    { name: 'usuarios-store' }
  )
);
