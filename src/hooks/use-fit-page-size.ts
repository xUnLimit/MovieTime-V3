'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FitRowsInput {
  /** Alto libre desde el inicio de la tabla hasta el borde inferior del area visible. */
  available: number;
  rowHeight: number;
  headerHeight: number;
  /** Alto reservado para pie de paginacion y margenes. */
  reserve: number;
  minRows: number;
  maxRows: number;
}

/** Cuantas filas caben sin que la pagina tenga que hacer scroll vertical. Pura, para poder probarla. */
export function computeFitRows({ available, rowHeight, headerHeight, reserve, minRows, maxRows }: FitRowsInput): number {
  const rows = Math.floor((available - headerHeight - reserve) / Math.max(rowHeight, 1));
  return Math.max(minRows, Math.min(maxRows, rows));
}

/**
 * Tamano de pagina a aplicar. El alto de fila es una constante, asi que la medida es estable y no hay
 * histeresis: si cabe una fila mas, se muestra (todas las tablas llegan a 10 cuando hay espacio).
 */
export function settleFitRows(current: number | undefined, fit: number): number {
  return current === fit ? current : fit;
}

/** Filas por pagina iniciales, estimadas con el alto de la ventana, para acertar desde la primera carga. */
export function estimateInitialPageSize(rowHeight = DEFAULT_ROW_HEIGHT, fallback = 10): number {
  if (typeof window === 'undefined' || window.matchMedia?.('(max-width: 767px)').matches) return fallback;
  return Math.max(5, Math.min(MAX_ROWS, Math.floor((window.innerHeight - 403) / rowHeight)));
}

interface UseFitPageSizeOptions {
  enabled?: boolean;
  rowHeight?: number;
  headerHeight?: number;
  reserve?: number;
  minRows?: number;
  maxRows?: number;
  /** Cambia cuando el contenido de arriba o de la tabla cambia (carga, cantidad de filas) y hay que volver a medir. */
  remeasureKey?: unknown;
}

/** Alto de fila que se asume: es una constante por tabla (no se mide) para que el resultado no dependa de los datos cargados. */
const DEFAULT_ROW_HEIGHT = 49;

/** Todas las tablas muestran 10 filas cuando caben; con menos alto, las que quepan (minimo 5). */
const MAX_ROWS = 10;

const MOBILE_QUERY = '(max-width: 767px)';

/**
 * Ajusta el numero de filas por pagina al alto disponible, para que la tabla se vea completa sin scroll
 * vertical. En movil devuelve `null` (la pagina hace scroll natural). Enlaza `ref` a la region de la tabla.
 */
export function useFitPageSize({
  enabled = true,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = 36,
  reserve = 46,
  minRows = 5,
  maxRows = MAX_ROWS,
  remeasureKey,
}: UseFitPageSizeOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<number | null>(null);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setRows(null);
      return;
    }

    const scroller = element.closest('main');
    const viewport = scroller ? scroller.clientHeight : window.innerHeight;
    const scrollerTop = scroller ? scroller.getBoundingClientRect().top : 0;
    const scrolled = scroller ? scroller.scrollTop : 0;
    // Posicion de la tabla dentro del area con scroll, independiente de cuanto se haya desplazado.
    const top = element.getBoundingClientRect().top - scrollerTop + scrolled;

    const fit = computeFitRows({
      available: viewport - top,
      rowHeight,
      headerHeight,
      reserve,
      minRows,
      maxRows,
    });
    setRows((previous) => (previous === fit ? previous : fit));
  }, [enabled, headerHeight, maxRows, minRows, reserve, rowHeight]);

  useEffect(() => {
    if (!enabled) return undefined;
    // Se mide fuera del cuerpo del efecto (frame siguiente) y desde callbacks de observadores.
    const frame = window.requestAnimationFrame(measure);
    const scroller = ref.current?.closest('main');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer && scroller) observer.observe(scroller);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, measure, remeasureKey]);

  return { ref, rows };
}
