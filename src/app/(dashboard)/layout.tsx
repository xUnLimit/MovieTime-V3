'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AuthRecoveryState } from '@/components/auth/AuthRecoveryState';
import { shouldRedirectToLogin } from '@/components/auth/auth-routing';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Logo } from '@/components/shared/Logo';
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { sincronizarNotificaciones } from '@/modules/notifications';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { authRecoveryError, isAuthenticated, isHydrated, logout, retryAuth } = useAuthStore();
  // En iPad vertical (768-1023px) la barra empieza como riel de iconos para dar ancho al contenido.
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const [manualCollapsed, setSidebarCollapsed] = useState<boolean | null>(null);
  const sidebarCollapsed = manualCollapsed ?? isTablet;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const redirectToLogin = shouldRedirectToLogin({
    isHydrated,
    isAuthenticated,
    authRecoveryError,
  });

  useEffect(() => {
    // Solo redirigir después de que Zustand se haya hidratado
    if (redirectToLogin) {
      router.push('/login');
    }
  }, [redirectToLogin, router]);

  // Sincronizar notificaciones cuando el usuario está autenticado
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      safeAsyncSideEffect(sincronizarNotificaciones(), {
        operation: 'sincronizarNotificaciones',
        entity: 'notificacion',
      });
    }
  }, [isHydrated, isAuthenticated]);

  // Mostrar loader mientras se hidrata el estado desde localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (authRecoveryError) {
    return (
      <AuthRecoveryState message={authRecoveryError} onRetry={retryAuth} onLogout={logout} />
    );
  }

  // Ya hidratado y sin sesión (p. ej. al cerrarla): la redirección a /login es inmediata, así que se
  // deja solo el fondo; un spinner que aparece y desaparece en unos milisegundos se ve como parpadeo.
  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return (
    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <div className="flex h-[100dvh] overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Account for the top safe area in full-screen mobile layouts. */}
          <header
            className="relative z-[66] flex shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 md:hidden"
            style={{
              height: 'calc(56px + env(safe-area-inset-top))',
              paddingTop: 'env(safe-area-inset-top)',
            }}
          >
            <button
              onClick={openMobileSidebar}
              className="-ml-2 flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <Logo className="size-5" />
            <span className="text-sm font-semibold tracking-tight">MovieTime PTY</span>
          </header>

          {/* Main: ocupa toda la pantalla; el fondo llega a los bordes y el contenido respeta las areas seguras. */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none bg-background">
            <div className="h-full min-w-0 overflow-x-hidden px-[max(0.75rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-[max(1rem,env(safe-area-inset-left))] sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
