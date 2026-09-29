'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Moon, Sun } from 'lucide-react';

import { cn } from '@/platform/utils';
import { useTheme } from '@/components/layout/ThemeProvider';
import { Logo } from '@/components/shared/Logo';
import { useSidebarState } from '@/hooks/use-sidebar';
import { useAuthStore } from '@/store/authStore';
import { UserMenu } from './UserMenu';
import { getSidebarNavigationSections, isNavItemActive } from './sidebar-navigation';
import { SIDEBAR_WIDTH, SidebarRowContent, SidebarTooltip, sidebarRowClassName } from './SidebarParts';
import { useWhatsAppUnreadChats } from '@/hooks/use-whatsapp-chat';
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

  const unreadChats = useWhatsAppUnreadChats(user?.role === 'admin');

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

  const sidebarContent = (isMobile: boolean, withRef = false) => {
    const hideLabel = !isMobile && collapsed;
    const width = isMobile ? SIDEBAR_WIDTH.mobile : collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded;

    return (
      <aside
        data-collapsed={isMobile ? false : collapsed}
        className={cn(
          'relative flex h-full flex-col bg-sidebar',
          !isMobile && 'border-r border-sidebar-border transition-[width] duration-300 ease-in-out'
        )}
        style={{ width }}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 overflow-hidden border-b border-sidebar-border pl-[18px] text-sidebar-foreground">
          <Logo className="size-5" />
          <span
            className={cn(
              'text-sm font-semibold tracking-tight whitespace-nowrap transition-opacity duration-200',
              hideLabel && 'pointer-events-none opacity-0'
            )}
          >
            MovieTime PTY
          </span>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {filteredSections.map((section, sectionIdx) => (
            <div
              key={sectionIdx}
              className={cn('pb-2', sectionIdx > 0 && 'mt-2 border-t border-sidebar-border pt-3')}
            >
              {section.label && (
                <p
                  className={cn(
                    'h-6 truncate px-3 text-xs font-medium text-muted-foreground transition-opacity duration-200',
                    hideLabel && 'opacity-0'
                  )}
                >
                  {section.label}
                </p>
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  const badge = item.href === '/chats' && unreadChats > 0 ? String(unreadChats) : item.badge;

                  return (
                    <SidebarTooltip key={item.name} label={item.name} enabled={hideLabel}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        aria-current={isActive ? 'page' : undefined}
                        className={sidebarRowClassName(isActive)}
                      >
                        <SidebarRowContent
                          icon={item.icon}
                          label={item.name}
                          hideLabel={hideLabel}
                          active={isActive}
                          badge={badge}
                          badgeLabel={item.href === '/chats' && badge ? `${badge} chats sin leer` : undefined}
                        />
                      </Link>
                    </SidebarTooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto shrink-0 space-y-0.5 border-t border-sidebar-border p-2">
          <SidebarTooltip label="Cambiar tema" enabled={hideLabel}>
            <button
              type="button"
              ref={withRef ? themeButtonRef : undefined}
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className={sidebarRowClassName()}
            >
              <SidebarRowContent icon={theme === 'dark' ? Sun : Moon} label="Tema" hideLabel={hideLabel} />
            </button>
          </SidebarTooltip>

          {!isMobile && (
            <SidebarTooltip label="Expandir" enabled={collapsed}>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
                className={sidebarRowClassName()}
              >
                <SidebarRowContent
                  icon={ChevronLeft}
                  iconClassName={cn('transition-transform duration-300', collapsed && 'rotate-180')}
                  label="Colapsar"
                  hideLabel={collapsed}
                />
              </button>
            </SidebarTooltip>
          )}

          <UserMenu variant="sidebar" collapsed={hideLabel} isMobile={isMobile} />
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden h-[100dvh] md:flex">{sidebarContent(false, true)}</div>

      {/* Mobile overlay — siempre en el DOM para que la transición CSS funcione */}
      <div
        className="fixed top-0 right-0 left-0 z-[65] bg-black/50 md:hidden"
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
        className="fixed top-0 bottom-0 left-0 z-[70] flex flex-col bg-sidebar md:hidden"
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
