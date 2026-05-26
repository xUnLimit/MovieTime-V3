import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { TemplateMensaje } from '@/types';

interface TemplatesState {
  error: string | null;
  selectedTemplate: TemplateMensaje | null;
  setError: (error: string | null) => void;
  setSelectedTemplate: (template: TemplateMensaje | null) => void;
}

export const useTemplatesStore = create<TemplatesState>()(
  devtools(
    (set) => ({
      error: null,
      selectedTemplate: null,
      setError: (error) => set({ error }),
      setSelectedTemplate: (template) => set({ selectedTemplate: template }),
    }),
    { name: 'templates-store' }
  )
);
