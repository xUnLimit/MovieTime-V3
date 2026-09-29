'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Suscripcion reactiva a una media query; en el servidor devuelve `false`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Raton o trackpad. En pantallas tactiles no se enfoca automaticamente un buscador dentro de un menu:
 * el teclado virtual achica la pantalla y el menu se reubica mientras se abre.
 */
export function useFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}
