'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { PwaStatusBanner } from '@/components/pwa/PwaStatusBanner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback';
import { sincronizarNotificaciones } from '@/lib/services/notificationSyncService';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // Solo redirigir después de que Zustand se haya hidratado
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isHydrated, router]);

  // Sincronizar notificaciones cuando el usuario está autenticado
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      sincronizarNotificaciones().catch((error) => {
        console.error('Error syncing notifications:', error);
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
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile top bar — fixed para cubrir el border-r del sidebar en la safe area */}
          <div
            className="fixed top-0 left-0 right-0 flex items-center px-4 bg-sidebar md:hidden z-[60]"
            style={{
              height: 'calc(3.5rem + env(safe-area-inset-top))',
              paddingTop: 'env(safe-area-inset-top)',
            }}
          >
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-foreground hover:bg-muted transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 text-base font-semibold">MovieTime PTY</span>
          </div>
          {/* Espaciador para compensar el top bar fixed */}
          <div
            className="md:hidden flex-shrink-0"
            style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}
          />

          {/* Main */}
          <main
            className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none bg-background"
            style={{
              paddingBottom: 'min(env(safe-area-inset-bottom), 0px)',
              backgroundClip: 'content-box',
            }}
          >
            <div className="h-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6">
              <PwaStatusBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
