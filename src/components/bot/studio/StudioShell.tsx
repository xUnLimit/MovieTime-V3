import type { ReactNode } from 'react';

type StudioShellProps = {
  /** Columna izquierda: la lista de pasos. */
  sidebar: ReactNode;
  /** Barra sobre el lienzo: estado a la izquierda y acciones a la derecha. */
  status: ReactNode;
  actions: ReactNode;
  /** Avisos bajo la barra (problemas que no son de un paso). */
  banner?: ReactNode;
  /** Columna derecha: editar el paso o probar el recorrido. */
  inspector: ReactNode;
  /** El lienzo, que llena el centro. */
  children: ReactNode;
};

/** Las tres columnas del estudio con su alto fijo: lo que sobra de la ventana, sin scroll de página. */
export function StudioShell({ sidebar, status, actions, banner, inspector, children }: StudioShellProps) {
  return <section aria-label="Estudio del recorrido" className="grid h-[calc(100dvh-14rem)] min-h-[34rem] grid-cols-[15rem_minmax(0,1fr)_22rem] overflow-hidden rounded-xl border bg-card">
    <div className="flex min-h-0 flex-col border-r">{sidebar}</div>
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">{status}<div className="flex items-center gap-2">{actions}</div></div>
      {banner}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
    <aside aria-label="Inspector" className="flex min-h-0 flex-col border-l">{inspector}</aside>
  </section>;
}
