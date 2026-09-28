'use client';

import { useEffect, useRef, useState } from 'react';

// Se dispara una sola vez, la primera vez que el elemento entra al viewport
// (con margen extra para precargar un poco antes de que se vea), y deja de
// observar despues: evita bajar de golpe todos los adjuntos del historial al
// abrir un chat, igual que hace WhatsApp con las imagenes fuera de pantalla.
const ROOT_MARGIN = '600px 0px';

function hasIntersectionObserver() {
  return typeof IntersectionObserver !== 'undefined';
}

export function useInViewOnce<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => !hasIntersectionObserver());

  useEffect(() => {
    if (!enabled || inView || !hasIntersectionObserver()) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, inView]);

  return { ref, inView };
}
