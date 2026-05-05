'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
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
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Mobile top bar */}
          <div className="flex items-center h-14 px-4 border-b border-border bg-background md:hidden flex-shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-foreground hover:bg-muted transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 text-base font-semibold">MovieTime PTY</span>
          </div>

          {/* Main */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="h-full p-3 sm:p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
