import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { TemplateMensaje, TipoTemplate } from '@/types';
import { getAll, create as createDoc, update, remove, COLLECTIONS, logCacheHit } from '@/lib/firebase/firestore';
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

interface TemplatesState {
  templates: TemplateMensaje[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedTemplate: TemplateMensaje | null;

  // Actions
  fetchTemplates: (force?: boolean) => Promise<void>;
  createTemplate: (template: Omit<TemplateMensaje, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<TemplateMensaje>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setSelectedTemplate: (template: TemplateMensaje | null) => void;
  getTemplateByTipo: (tipo: TipoTemplate) => TemplateMensaje | undefined;
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

export const useTemplatesStore = create<TemplatesState>()(
  devtools(
    persist(
      (set, get) => ({
        templates: [],
        isLoading: false,
        error: null,
        lastFetch: null,
        selectedTemplate: null,

        fetchTemplates: async (force = false) => {
          const { lastFetch } = get();
          if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
            logCacheHit(COLLECTIONS.TEMPLATES);
            return;
          }

          set({ isLoading: true, error: null });
          try {
            const templates = await getAll<TemplateMensaje>(COLLECTIONS.TEMPLATES);
            set({ templates, isLoading: false, error: null, lastFetch: Date.now() });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar templates';
            console.error('Error fetching templates:', error);
            set({ isLoading: false, error: errorMessage });
          }
        },

        createTemplate: async (templateData) => {
          try {
            const id = await createDoc(COLLECTIONS.TEMPLATES, templateData as Omit<TemplateMensaje, 'id'>);

            const newTemplate: TemplateMensaje = {
              ...templateData,
              id,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            set((state) => ({
              templates: [...state.templates, newTemplate]
            }));

            // Registrar en log de actividad
            useActivityLogStore.getState().addLog({
              ...getLogContext(),
              accion: 'creacion',
              entidad: 'template',
              entidadId: id,
              entidadNombre: templateData.nombre,
              detalles: `Template creado: "${templateData.nombre}" (${templateData.tipo})`,
            }).catch(() => {});
          } catch (error) {
            console.error('Error creating template:', error);
            throw error;
          }
        },

        updateTemplate: async (id, updates) => {
          const oldTemplate = get().templates.find(t => t.id === id);

          try {
            await update(COLLECTIONS.TEMPLATES, id, updates);

            // Detectar cambios para el log
            const cambios = oldTemplate ? detectarCambios('template', oldTemplate, {
              ...oldTemplate,
              ...updates
            }) : [];

            set((state) => ({
              templates: state.templates.map((template) =>
                template.id === id
                  ? { ...template, ...updates, updatedAt: new Date() }
                  : template
              )
            }));

            // Registrar en log de actividad con cambios
            useActivityLogStore.getState().addLog({
              ...getLogContext(),
              accion: 'actualizacion',
              entidad: 'template',
              entidadId: id,
              entidadNombre: oldTemplate?.nombre ?? id,
              detalles: `Template actualizado: "${oldTemplate?.nombre}"`,
              cambios: cambios.length > 0 ? cambios : undefined,
            }).catch(() => {});
          } catch (error) {
            console.error('Error updating template:', error);
            throw error;
          }
        },

        deleteTemplate: async (id) => {
          const templateEliminado = get().templates.find(t => t.id === id);

          try {
            await remove(COLLECTIONS.TEMPLATES, id);

            set((state) => ({
              templates: state.templates.filter((template) => template.id !== id)
            }));

            // Registrar en log de actividad
            useActivityLogStore.getState().addLog({
              ...getLogContext(),
              accion: 'eliminacion',
              entidad: 'template',
              entidadId: id,
              entidadNombre: templateEliminado?.nombre ?? id,
              detalles: `Template eliminado: "${templateEliminado?.nombre}"`,
            }).catch(() => {});
          } catch (error) {
            console.error('Error deleting template:', error);
            throw error;
          }
        },

        setSelectedTemplate: (template) => {
          set({ selectedTemplate: template });
        },

        getTemplateByTipo: (tipo) => {
          return get().templates.find((t) => t.tipo === tipo && t.activo);
        }
      }),
      {
        name: 'templates-storage',
        partialize: (state) => ({ templates: state.templates })
      }
    )
  )
);
