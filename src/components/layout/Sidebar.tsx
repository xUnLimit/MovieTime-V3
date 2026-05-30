'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Moon, Sun } from 'lucide-react';

import { cn } from '@/platform/utils';
import { useTheme } from '@/components/layout/ThemeProvider';
import { useSidebarState } from '@/hooks/use-sidebar';
import { useAuthStore } from '@/store/authStore';
import { UserMenu } from './UserMenu';
import { getSidebarNavigationSections } from './sidebar-navigation';
import { useSidebarThemeTransition } from './useSidebarThemeTransition';

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
  const previousPathnameRef = useRef(pathname);
  const toggleTheme = useSidebarThemeTransition({
    setTheme,
    theme,
    themeButtonRef,
  });

  const filteredSections = useMemo(() => {
    return getSidebarNavigationSections(user?.role);
  }, [user?.role]);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : !isOpen;
  const setCollapsed = useCallback(
    (nextCollapsed: boolean) => {
      if (onCollapse) {
        onCollapse(nextCollapsed);
        return;
      }

      if (nextCollapsed !== collapsed) {
        toggle();
      }
    },
    [collapsed, onCollapse, toggle],
  );

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
  }, [collapsed, setCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (previousPathname !== pathname && mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [mobileOpen, onMobileClose, pathname]);

  const sidebarContent = (isMobile: boolean, withRef = false) => (
    <aside
      data-collapsed={isMobile ? false : collapsed}
      className={cn(
        "relative flex flex-col bg-sidebar h-full",
        !isMobile && "border-r border-sidebar-border transition-[width] duration-300 ease-in-out"
      )}
      style={{
        width: isMobile ? '200px' : (collapsed ? '48px' : '200px'),
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
                    prefetch={false}
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
            {sectionIdx < filteredSections.length - 1 && (
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
            ref={withRef ? themeButtonRef : undefined}
            onClick={toggleTheme}
            aria-label="Cambiar tema"
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

          <UserMenu variant="sidebar" collapsed={!isMobile && collapsed} isMobile={isMobile} />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-[100dvh]">
        {sidebarContent(false, true)}
      </div>

      {/* Mobile overlay — siempre en el DOM para que la transición CSS funcione */}
      <div
        className="fixed top-0 left-0 right-0 z-[65] bg-black/50 md:hidden"
        style={{
          bottom: 'env(safe-area-inset-bottom)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 300ms ease-in-out',
        }}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />
      {/* Mobile drawer — siempre en el DOM para que el slide funcione al cerrar */}
      <div
        className="fixed left-0 top-0 bottom-0 z-[70] md:hidden flex flex-col bg-sidebar"
        style={{
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
          visibility: mobileOpen ? 'visible' : 'hidden',
          transitionProperty: 'transform, visibility',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.25)',
        }}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent(true)}
      </div>
    </>
  );
}
