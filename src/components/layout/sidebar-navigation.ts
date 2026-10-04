import type { ComponentType } from 'react';
import {
  Bell,
  Bot,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Pause,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tv2,
  Users,
} from 'lucide-react';

export type SidebarNavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  /** Existe para migas y rutas activas, pero no se dibuja en el menu lateral (p. ej. Configuracion, que se abre desde el menu de usuario). */
  hidden?: boolean;
};

export type SidebarNavSection = {
  label?: string;
  items: SidebarNavItem[];
};

const adminOnlyPaths = [
  '/chats',
  '/automatizaciones',
  '/pedidos-cobros',
  '/gastos',
  '/plantillas-mensajes',
  '/categorias',
  '/metodos-pago',
  '/log-actividad',
  '/configuracion',
];

const navigationSections: SidebarNavSection[] = [
  {
    label: 'Inicio',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        name: 'Terceros',
        href: '/terceros',
        icon: Users,
      },
      {
        name: 'Ventas',
        href: '/ventas',
        icon: ShoppingCart,
      },
      {
        name: 'Pedidos y cobros',
        href: '/pedidos-cobros',
        icon: ShoppingBag,
      },
      {
        name: 'Servicios',
        href: '/servicios',
        icon: Tv2,
      },
      {
        name: 'Gastos',
        href: '/gastos',
        icon: DollarSign,
      },
    ],
  },
  {
    label: 'Seguimiento',
    items: [
      {
        name: 'Notificaciones',
        href: '/notificaciones',
        icon: Bell,
      },
      {
        name: 'Chats',
        href: '/chats',
        icon: MessageCircle,
      },
      {
        name: 'Automatizaciones',
        href: '/automatizaciones',
        icon: Bot,
      },
      {
        name: 'Servicios en Reposo',
        href: '/reposo',
        icon: Pause,
      },
      {
        name: 'Log de Actividad',
        href: '/log-actividad',
        icon: FileText,
      },
    ],
  },
  {
    label: 'Configuración',
    items: [
      {
        name: 'Categorías',
        href: '/categorias',
        icon: Folder,
      },
      {
        name: 'Métodos de Pago',
        href: '/metodos-pago',
        icon: CreditCard,
      },
      {
        name: 'Plantillas de mensajes',
        href: '/plantillas-mensajes',
        icon: MessageSquare,
      },
      {
        name: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        hidden: true,
      },
    ],
  },
];

export function getSidebarNavigationSections(
  userRole: string | undefined,
): SidebarNavSection[] {
  return navigationSections
    .map((section) => {
      const items = section.items.filter((item) => {
        if (item.hidden) return false;
        if (!adminOnlyPaths.includes(item.href)) return true;
        return userRole === 'admin';
      });

      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}

/** Item del menu que contiene la ruta (el de href mas largo). Sirve para las migas y el titulo de seccion. */
export function findNavItem(pathname: string): SidebarNavItem | undefined {
  return navigationSections
    .flatMap((section) => section.items)
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Un item esta activo en su ruta exacta y en cualquiera de sus subrutas (p. ej. /ventas/crear resalta Ventas).
 * Las rutas anteriores (/bot, /editor-mensajes, /pagos-yappy, /automatizaciones/pedidos...) redirigen en el servidor.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
