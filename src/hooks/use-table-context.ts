'use client';

import { useEffect, useState } from 'react';
import { z } from '@/platform/validation/zod';
import { reportError } from '@/platform/observability/logger';

const schema = z.object({ filter: z.string().max(100), search: z.string().max(300), selection: z.string().max(100).nullable() });
const defaults = { filter: 'all', search: '', selection: null };

/** Solo filtros y selección de UI; los datos del negocio se vuelven a consultar. */
export function useTableContext(scope: string) {
  const key = `movietime:table:${scope}`;
  const [context, setContext] = useState(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = window.sessionStorage.getItem(key);
      return saved ? schema.safeParse(JSON.parse(saved)).data ?? defaults : defaults;
    } catch {
      reportError('TableContext', 'No se pudo restaurar el contexto de la tabla', new Error('storage_read_failed'));
      return defaults;
    }
  });
  useEffect(() => {
    try { window.sessionStorage.setItem(key, JSON.stringify(context)); }
    catch { reportError('TableContext', 'No se pudo conservar el contexto de la tabla', new Error('storage_write_failed')); }
  }, [key, context]);
  return { ...context, setFilter: (filter: string) => setContext(current => ({ ...current, filter })), setSearch: (search: string) => setContext(current => ({ ...current, search })), setSelection: (selection: string | null) => setContext(current => ({ ...current, selection })) };
}
