'use client';

import { useEffect } from 'react';

export const APP_HEIGHT_VAR = '--app-height';

// iOS (Safari y PWA) ignora `interactiveWidget: resizes-content`: al abrir el teclado solo
// encoge el viewport visual y desplaza la pagina, con lo que el compositor del chat y el
// encabezado quedan tapados o fuera de pantalla. Publicamos la altura visible como variable
// CSS para que el layout se ajuste al espacio real sobre el teclado.
export function useVisualViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty(APP_HEIGHT_VAR, `${Math.round(viewport.height)}px`);
      // iOS desplaza la pagina para dejar ver el campo enfocado; el layout ya cabe en el
      // viewport visual, asi que se vuelve al origen para que nada quede fuera de pantalla.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty(APP_HEIGHT_VAR);
    };
  }, []);
}
