'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/platform/utils/cn';

const sections = [
  { href: '/automatizaciones', label: 'Recorridos' },
  { href: '/automatizaciones/compras', label: 'Compras' },
  { href: '/automatizaciones/pedidos', label: 'Pedidos' },
  { href: '/automatizaciones/cobros', label: 'Cobros' },
  { href: '/automatizaciones/interesados', label: 'Interesados' },
  { href: '/automatizaciones/mensajes', label: 'Mensajes' },
  { href: '/automatizaciones/conexiones', label: 'Conexiones' },
];

/** Pestañas de enlace entre las secciones de Automatizaciones. Cada una es una ruta propia. */
export function AutomationNavigation() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Secciones de automatizaciones" className="tabs-scroll-shell flex h-9 gap-4 border-b">
      {sections.map(section => {
        const active = pathname === section.href || (section.href !== '/automatizaciones' && pathname.startsWith(`${section.href}/`));
        return (
          <Link
            key={section.href}
            href={section.href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn('inline-flex h-9 shrink-0 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring', active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
