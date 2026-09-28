'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AuthRecoveryState } from '@/components/auth/AuthRecoveryState';
import { shouldRedirectToLogin } from '@/components/auth/auth-routing';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback';
import { sincronizarNotificaciones } from '@/modules/notifications';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { authRecoveryError, isAuthenticated, isHydrated, logout, retryAuth } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (authRecoveryError) {
    return (
      <AuthRecoveryState message={authRecoveryError} onRetry={retryAuth} onLogout={logout} />
    );
  }

  // Si ya se hidrató pero no está autenticado, mostrar loader mientras redirige
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <div className="flex h-[100svh] overflow-hidden">
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
            className="relative z-[66] flex shrink-0 items-center bg-sidebar px-[16px] md:hidden"
            style={{
              height: 'calc(56px + env(safe-area-inset-top))',
              paddingTop: 'env(safe-area-inset-top)',
            }}
          >
            <button
              onClick={openMobileSidebar}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
              aria-label="Abrir menú"
            >
              <Menu className="h-[20px] w-[20px]" />
            </button>
            <span className="ml-[12px] text-[16px] leading-[24px] font-semibold">MovieTime PTY</span>
          </header>

          {/* Main */}
          <main
            className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none bg-background"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.25)',
              backgroundClip: 'content-box',
            }}
          >
            <div className="h-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
