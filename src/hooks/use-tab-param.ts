'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Pestaña activa de una página, leída de `?tab=` (lista cerrada: un valor desconocido abre la primera) y escrita en la
 * URL al cambiar, para que los enlaces y las redirecciones abran la pestaña correcta. Los demás parámetros se conservan.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (value: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get('tab');
  // La elección se muestra al instante; en cuanto la URL la refleja (o cambia por fuera), manda la URL.
  const [chosen, setChosen] = useState<{ from: string | null; tab: T } | null>(null);
  const fromUrl = tabs.find((tab) => tab === requested) ?? fallback;
  const current = chosen && chosen.from === requested ? chosen.tab : fromUrl;

  const select = useCallback((value: string) => {
    const tab = tabs.find((candidate) => candidate === value);
    if (!tab) return;
    setChosen({ from: requested, tab });
    const next = new URLSearchParams(params.toString());
    next.set('tab', tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [tabs, requested, params, pathname, router]);

  return [current, select];
}
