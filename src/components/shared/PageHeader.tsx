'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { findNavItem } from '@/components/layout/sidebar-navigation';
import { cn } from '@/platform/utils';

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /**
   * Elementos despues de la seccion: en detalle/crear/editar, `[{ label: 'Nueva venta' }]`.
   * La miga base (`Dashboard › Seccion`) se calcula sola desde el menu lateral.
   */
  trail?: PageHeaderBreadcrumb[];
  /** Sustituye por completo la miga automatica (casos excepcionales). */
  breadcrumb?: PageHeaderBreadcrumb[];
  /** Destino del enlace "Volver". Por defecto es el padre inmediato de la miga; usalo cuando se llega desde otro origen (p. ej. un chat). */
  backTo?: string;
  /** Acciones de la pagina, siempre a la derecha. Orden: secundarias, destructiva y la principal al final. */
  actions?: ReactNode;
  className?: string;
}

/** Miga estandar: Dashboard › Seccion [› elemento]. La seccion enlaza solo cuando hay un elemento debajo. */
export function buildBreadcrumb(pathname: string, trail: PageHeaderBreadcrumb[] = []): PageHeaderBreadcrumb[] {
  const section = findNavItem(pathname);
  if (!section || section.href === '/dashboard') return [];

  return [
    { label: 'Dashboard', href: '/dashboard' },
    { label: section.name, href: trail.length > 0 ? section.href : undefined },
    ...trail,
  ];
}

/**
 * Encabezado unico de pagina: miga, titulo, descripcion y acciones.
 * La miga va SIEMPRE encima del titulo y las acciones SIEMPRE a la derecha, iguales en todas las pantallas.
 */
export function PageHeader({ title, description, trail, breadcrumb, backTo, actions, className }: PageHeaderProps) {
  const pathname = usePathname();
  const crumbs = breadcrumb ?? buildBreadcrumb(pathname ?? '', trail);
  // "Volver" solo existe en paginas de segundo nivel (detalle/crear/editar): lleva al padre inmediato de la miga.
  const parent = [...crumbs].reverse().find((item) => item.href);
  const backHref = backTo ?? (crumbs.length > 2 ? parent?.href : undefined);

  return (
    <header data-slot="page-header" className={cn('space-y-1', className)}>
      {crumbs.length > 0 || backHref ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {backHref ? (
            <Link
              prefetch={false}
              href={backHref}
              aria-label="Volver"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft aria-hidden className="size-3" />
              Volver
            </Link>
          ) : null}
          {crumbs.length > 0 ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1">
                {crumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight aria-hidden className="size-3" /> : null}
                    {item.href ? (
                      <Link prefetch={false} href={item.href} className="transition-colors hover:text-foreground">
                        {item.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-foreground">
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-h-8 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
