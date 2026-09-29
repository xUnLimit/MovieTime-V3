'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { cn } from '@/platform/utils';

interface MetricGridProps {
  children: ReactNode;
  /** `cards`: tarjetas separadas. `strip`: una sola franja con divisores. */
  variant?: 'cards' | 'strip';
  className?: string;
}

/**
 * Distribucion unica para cualquier cantidad de tarjetas (1, 2, 3, 6...): partes iguales que ocupan todo el
 * ancho en una sola fila mientras quepan (minimo 152px por tarjeta); si no caben, envuelven a la fila siguiente.
 */
const AUTO_FIT_COLUMNS = 'grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]';

const MetricStripContext = createContext(false);

/** Indica a un `MetricCard` que vive dentro de una franja y debe renderizarse plano. */
export function useMetricStrip() {
  return useContext(MetricStripContext);
}

export function MetricGrid({ children, variant = 'cards', className }: MetricGridProps) {
  if (variant === 'strip') {
    return (
      <MetricStripContext.Provider value>
        <div data-slot="metric-grid" data-variant="strip" className={cn('overflow-hidden rounded-xl border bg-card', className)}>
          {/* Los margenes negativos ocultan el ultimo borde de cada fila/columna sin importar como envuelva. */}
          <div className={cn('-mr-px -mb-px grid', AUTO_FIT_COLUMNS)}>{children}</div>
        </div>
      </MetricStripContext.Provider>
    );
  }

  return (
    <div data-slot="metric-grid" data-variant="cards" className={cn('grid gap-3', AUTO_FIT_COLUMNS, className)}>
      {children}
    </div>
  );
}
