import type { ComponentType } from 'react';
import {
  Bell,
  DollarSign,
  FileText,
  Folder,
  LayoutDashboard,
  MessageSquare,
  Pause,
  ShoppingCart,
  Tv2,
  Users,
  Wallet,
} from 'lucide-react';

export type SidebarNavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

export type SidebarNavSection = {
  label?: string;
  items: SidebarNavItem[];
};

const adminOnlyPaths = [
  '/gastos',
  '/editor-mensajes',
  '/categorias',
  '/metodos-pago',
  '/log-actividad',
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
        icon: Wallet,
      },
      {
        name: 'Plantillas de Mensajes',
        href: '/editor-mensajes',
        icon: MessageSquare,
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
        if (!adminOnlyPaths.includes(item.href)) return true;
        return userRole === 'admin';
      });

      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}
