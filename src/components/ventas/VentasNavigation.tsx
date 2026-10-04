'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/platform/utils/cn';
import { useAuthStore } from '@/store/authStore';

const views = [
  { href: '/ventas', label: 'Suscripciones' },
  { href: '/ventas/pedidos', label: 'Pedidos' },
  { href: '/ventas/cobros', label: 'Cobros' },
];

export function VentasNavigation() {
  const pathname = usePathname();
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  return <nav aria-label="Vistas de ventas" className="flex h-9 min-w-0 gap-4 border-b">{views.filter(view => isAdmin || view.href === '/ventas').map(view => <Link key={view.href} href={view.href} prefetch={false} aria-current={pathname === view.href ? 'page' : undefined} className={cn('inline-flex h-9 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring', pathname === view.href ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{view.label}</Link>)}</nav>;
}
