'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Tv2,
  ShoppingCart,
  Bell,
  Folder,
  Wallet,
  MessageSquare,
  FileText,
  Moon,
  Pause,
  DollarSign,
  Sun,
  ChevronLeft,
  X
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSidebarState } from '@/hooks/use-sidebar';
import { useAuthStore } from '@/store/authStore';
import React, { useEffect, useRef, useMemo } from 'react';

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: string };
type NavSection = { label?: string; items: NavItem[] };

const navigationSections: NavSection[] = [
  {
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard
      }
    ]
  },
  {
    label: 'GESTIÓN',
    items: [
      {
        name: 'Usuarios',
        href: '/usuarios',
        icon: Users
      },
      {
        name: 'Servicios',
        href: '/servicios',
        icon: Tv2
      },
      {
        name: 'Ventas',
        href: '/ventas',
        icon: ShoppingCart
      },
    ]
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      {
        name: 'Notificaciones',
        href: '/notificaciones',
        icon: Bell
      },
      {
        name: 'Categorías',
        href: '/categorias',
        icon: Folder
      },
      {
        name: 'Métodos de Pago',
        href: '/metodos-pago',
        icon: Wallet
      }
    ]
  },
  {
    label: 'OTROS',
    items: [
      {
        name: 'Gastos',
        href: '/gastos',
        icon: DollarSign
      },
      {
        name: 'Reposo',
        href: '/reposo',
        icon: Pause
      },
      {
        name: 'Editor de Mensajes',
        href: '/editor-mensajes',
        icon: MessageSquare
      },
      {
        name: 'Log de Actividad',
        href: '/log-actividad',
        icon: FileText
      }
    ]
  }
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onCollapse, mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const { isOpen, toggle } = useSidebarState();
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  // Filter sections based on user role
  const filteredSections = useMemo(() => {
    return navigationSections.map(section => {
      if (!user) return section;

      const items = section.items.filter(item => {
        // Admin-only paths
        const adminOnlyPaths = [
          '/gastos',
          '/editor-mensajes',
          '/categorias',
          '/metodos-pago',
          '/log-actividad'
        ];
        
        if (adminOnlyPaths.includes(item.href)) {
          return user.role === 'admin';
        }
        
        return true;
      });

      return { ...section, items };
    }).filter(section => section.items.length > 0);
  }, [user]);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : !isOpen;
  const setCollapsed = onCollapse || (() => toggle());

  // Keyboard shortcut: Ctrl/Cmd + B
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition || themeButtonRef.current === null) {
      setTheme(nextTheme);
      return;
    }

    const rect = themeButtonRef.current.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    // Calcular distancia exacta hasta la esquina más lejana de la pantalla
    const w = window.innerWidth;
    const h = window.innerHeight;
    const endRadius = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));

    document.documentElement.style.setProperty('--theme-transition-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-transition-y', `${y}px`);
    document.documentElement.style.setProperty('--theme-transition-radius', `${endRadius}px`);

    const transition = document.startViewTransition(() => {
      const root = document.documentElement;
      if (nextTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    });

    // Sincronizar next-themes solo después de que la animación termine
    // para evitar el re-render de React durante la transición
    transition.finished.then(() => {
      try { localStorage.setItem('theme', nextTheme); } catch {}
      setTheme(nextTheme);
    });
  };

  const sidebarContent = (isMobile: boolean) => (
    <aside
      data-collapsed={isMobile ? false : collapsed}
      className={cn(
        "relative flex flex-col bg-sidebar border-r border-sidebar-border h-full",
        !isMobile && "transition-[width] duration-300 ease-in-out"
      )}
      style={{
        width: isMobile ? '200px' : (collapsed ? '48px' : '200px')
      }}
    >
      {/* Header - Logo y Título */}
      <div className="relative h-16 border-b border-sidebar-border overflow-hidden flex-shrink-0">
        {/* Logo - posición absoluta fija, siempre centrado en los 48px del ancho colapsado */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center text-sidebar-foreground"
          style={{
            left: '2px',
            width: '48px',
            transition: 'left 300ms ease-in-out',
          }}
        >
          <Image
            src="/logo.svg"
            alt="MovieTime logo"
            width={28}
            height={28}
            priority
            className="w-7 h-7 dark:invert"
          />
        </div>

        {/* Texto - aparece a la derecha del logo */}
        <span
          className="absolute top-1/2 -translate-y-1/2 text-base font-semibold whitespace-nowrap"
          style={{
            left: '44px',
            opacity: isMobile ? 1 : (collapsed ? 0 : 1),
            transition: 'opacity 200ms ease-in-out',
            pointerEvents: (!isMobile && collapsed) ? 'none' : 'auto'
          }}
        >
          MovieTime PTY
        </span>

        {/* Botón cerrar en mobile */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center h-7 w-7 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {filteredSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-4">
            {/* Label de sección */}
            {section.label && (
              <div className="px-3 mb-2 h-5 overflow-hidden">
                <p
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  style={{
                    opacity: isMobile ? 1 : (collapsed ? 0 : 1),
                    transition: 'opacity 200ms ease-in-out'
                  }}
                >
                  {section.label}
                </p>
              </div>
            )}

            {/* Items */}
            <div className="space-y-1 px-2">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "relative flex items-center h-9 rounded-lg overflow-hidden",
                      "transition-colors duration-200",
                      isActive
                        ? "bg-primary/15 text-foreground border-l-2 border-primary font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    title={(!isMobile && collapsed) ? item.name : undefined}
                  >
                    {/* Icono - Posición ABSOLUTA FIJA */}
                    <div className="absolute left-0 w-11 h-9 flex items-center justify-center">
                      <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                    </div>

                    {/* Texto - Posición ABSOLUTA FIJA */}
                    <span
                      className="absolute left-11 text-sm whitespace-nowrap flex items-center gap-2"
                      style={{
                        opacity: isMobile ? 1 : (collapsed ? 0 : 1),
                        transition: 'opacity 200ms ease-in-out',
                        pointerEvents: (!isMobile && collapsed) ? 'none' : 'auto'
                      }}
                    >
                      {item.name}
                      {/* Badge (si existe) */}
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500 text-white rounded">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Separador - POSICIÓN FIJA */}
            {sectionIdx < navigationSections.length - 1 && (
              <div className="h-px w-full bg-sidebar-border my-4" />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border mt-auto flex-shrink-0">
        <div className="p-2 space-y-1">
          {/* Botón Tema */}
          <button
            ref={themeButtonRef}
            onClick={toggleTheme}
            className={cn(
              "relative flex items-center h-9 w-full rounded-lg overflow-hidden",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "transition-colors duration-200"
            )}
            title={(!isMobile && collapsed) ? "Tema" : undefined}
          >
            <div className="absolute left-0 w-11 h-9 flex items-center justify-center">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <span
              className="absolute left-11 text-sm whitespace-nowrap"
              style={{
                opacity: isMobile ? 1 : (collapsed ? 0 : 1),
                transition: 'opacity 200ms ease-in-out',
                pointerEvents: (!isMobile && collapsed) ? 'none' : 'auto'
              }}
            >
              Tema
            </span>
          </button>

          {/* Botón Colapsar - solo en desktop */}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "relative flex items-center h-9 w-full rounded-lg overflow-hidden",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "transition-colors duration-200"
              )}
              title={collapsed ? "Expandir" : "Colapsar"}
            >
              <div className="absolute left-0 w-11 h-9 flex items-center justify-center">
                <ChevronLeft
                  className="h-4 w-4"
                  style={{
                    transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 300ms ease-in-out'
                  }}
                />
              </div>
              <span
                className="absolute left-11 text-sm whitespace-nowrap"
                style={{
                  opacity: collapsed ? 0 : 1,
                  transition: 'opacity 200ms ease-in-out',
                  pointerEvents: collapsed ? 'none' : 'auto'
                }}
              >
                Colapsar
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen">
        {sidebarContent(false)}
      </div>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden flex h-full">
            {sidebarContent(true)}
          </div>
        </>
      )}
    </>
  );
}
