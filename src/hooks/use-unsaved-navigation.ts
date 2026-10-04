'use client';

import { useEffect } from 'react';

export function useUnsavedNavigation(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const close = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const destination = new URL(anchor.getAttribute('href') ?? '', window.location.href);
      if (destination.href === window.location.href || destination.protocol !== 'http:' && destination.protocol !== 'https:') return;
      if (!window.confirm('Hay cambios sin guardar. ¿Quieres salir y descartarlos?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', close);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', close); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
}
