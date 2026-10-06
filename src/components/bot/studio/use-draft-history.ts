import { useCallback, useEffect, useRef, useState } from 'react';
import type { BotAdminApi, BotDefinition } from '@/types/bot';

/** Cuántos estados anteriores se recuerdan. */
const LIMIT = 50;
/** Los cambios seguidos (por ejemplo, teclear un texto) cuentan como uno solo: se deshacen de una vez. */
const COALESCE_MS = 800;

type Update = (updater: (current: BotDefinition) => BotDefinition) => void;

/**
 * Deshacer y rehacer sobre el borrador. Envuelve `updateDraft`: antes de cada cambio recuerda el estado anterior. La historia
 * vive en el navegador y se reinicia al publicar (lo publicado es el nuevo punto de partida); descartar el borrador sí se puede deshacer.
 */
export function useDraftHistory(api: Pick<BotAdminApi, 'draft' | 'published' | 'updateDraft'>) {
  const { draft, published, updateDraft } = api;
  const past = useRef<BotDefinition[]>([]);
  const future = useRef<BotDefinition[]>([]);
  const lastEdit = useRef(0);
  const current = useRef(draft);
  // Las pilas se mutan en los manejadores (no en el render); el estado solo refleja cuántos pasos hay para habilitar los botones.
  const [size, setSize] = useState({ undo: 0, redo: 0 });
  const refresh = useCallback(() => setSize({ undo: past.current.length, redo: future.current.length }), []);

  useEffect(() => { current.current = draft; }, [draft]);
  useEffect(() => { past.current = []; future.current = []; refresh(); }, [published, refresh]);

  const edit = useCallback<Update>((updater) => {
    const before = current.current;
    if (before) {
      const now = Date.now();
      if (now - lastEdit.current > COALESCE_MS) past.current = [...past.current, before].slice(-LIMIT);
      lastEdit.current = now;
      future.current = [];
      refresh();
    }
    updateDraft(updater);
  }, [updateDraft, refresh]);

  const undo = useCallback(() => {
    const previous = past.current[past.current.length - 1];
    const now = current.current;
    if (!previous || !now) return;
    past.current = past.current.slice(0, -1);
    future.current = [now, ...future.current];
    lastEdit.current = 0;
    refresh();
    updateDraft(() => previous);
  }, [updateDraft, refresh]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    const now = current.current;
    if (!next || !now) return;
    future.current = rest;
    past.current = [...past.current, now].slice(-LIMIT);
    lastEdit.current = 0;
    refresh();
    updateDraft(() => next);
  }, [updateDraft, refresh]);

  return { edit, undo, redo, canUndo: size.undo > 0, canRedo: size.redo > 0 };
}
