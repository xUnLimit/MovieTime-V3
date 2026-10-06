import { z } from '@/platform/validation/zod';
import { reportError } from '@/platform/observability/logger';
import type { NodePosition } from '@/modules/bot-config';

/**
 * Posiciones del lienzo guardadas en este navegador. No forman parte de la definición del bot (cambiar el orden de los
 * nodos no es un cambio que publicar): viven aparte, por id de nodo, y sobreviven a recargar la página y a publicar.
 */
const STORAGE_KEY = 'movietime:bot-flow-layout:v1';
/** El estudio usa nodos más pequeños: su orden se recuerda aparte para no mezclar medidas. */
const COMPACT_STORAGE_KEY = 'movietime:bot-flow-layout:compact:v1';
export type LayoutVariant = 'card' | 'compact';
const keyOf = (variant: LayoutVariant) => (variant === 'compact' ? COMPACT_STORAGE_KEY : STORAGE_KEY);
/** Tope de nodos recordados: cada flujo admite 40, así que cubre varias versiones sin crecer sin límite. */
const MAX_ENTRIES = 300;
const COORDINATE_LIMIT = 100_000;

const schema = z.record(z.string().max(64), z.object({
  x: z.number().finite().min(-COORDINATE_LIMIT).max(COORDINATE_LIMIT),
  y: z.number().finite().min(-COORDINATE_LIMIT).max(COORDINATE_LIMIT),
}));

export function loadFlowLayout(variant: LayoutVariant = 'card'): Record<string, NodePosition> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(keyOf(variant));
    if (!saved) return {};
    const parsed = schema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : {};
  } catch {
    reportError('FlowLayout', 'No se pudo leer el orden guardado del lienzo', new Error('storage_read_failed'));
    return {};
  }
}

/** Guarda las posiciones de los nodos actuales sobre lo ya recordado (otros nodos de versiones anteriores se conservan). */
export function saveFlowLayout(positions: Readonly<Record<string, NodePosition>>, variant: LayoutVariant = 'card'): void {
  if (typeof window === 'undefined') return;
  try {
    const merged = { ...loadFlowLayout(variant), ...positions };
    const entries = Object.entries(merged).slice(-MAX_ENTRIES);
    window.localStorage.setItem(keyOf(variant), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    reportError('FlowLayout', 'No se pudo guardar el orden del lienzo', new Error('storage_write_failed'));
  }
}

/** Olvida el orden de los nodos indicados para que vuelvan a acomodarse solos. */
export function clearFlowLayout(ids: readonly string[], variant: LayoutVariant = 'card'): void {
  if (typeof window === 'undefined') return;
  try {
    const remaining = Object.fromEntries(Object.entries(loadFlowLayout(variant)).filter(([id]) => !ids.includes(id)));
    window.localStorage.setItem(keyOf(variant), JSON.stringify(remaining));
  } catch {
    reportError('FlowLayout', 'No se pudo restablecer el orden del lienzo', new Error('storage_write_failed'));
  }
}
