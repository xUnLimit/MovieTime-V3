/**
 * NotificationBell Component
 *
 * Features:
 * - Bell icon with dynamic badge color (orange > red > yellow hierarchy)
 * - Dropdown showing recent notifications summary
 * - "Ver todas" link to notification center
 * - Real-time updates from notificacionesStore
 *
 * Badge Color Hierarchy:
 * 1. Red (🔴): Any "critica" priority notifications
 * 2. Orange (🟠): Any resaltadas (highlighted) notifications
 * 3. Yellow (🟡): Any "alta" or "media" priority notifications
 * 4. Gray (⚫): Only "baja" priority or empty
 */

'use client';

import { useEffect, useState } from 'react';
import { Bell, ShoppingCart, Banknote, Moon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { esNotificacionVenta, esNotificacionServicio, esNotificacionReposo } from '@/types/notificaciones';

export function NotificationBell() {
  const { notificaciones, fetchNotificaciones } = useNotificacionesStore();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotificaciones();
  }, [fetchNotificaciones]);

  // Get unread notifications
  const unreadNotifications = notificaciones.filter((n) => !n.leida);

  // Count by type
  const ventasPorVencer = unreadNotifications.filter(esNotificacionVenta).length;
  const serviciosPorPagar = unreadNotifications.filter(esNotificacionServicio).length;
  const reposoCompletados = unreadNotifications.filter(esNotificacionReposo).length;

  // Color logic: red if any critica/vencida, yellow if any unread, off if none
  const hasRed = unreadNotifications.some((n) => n.prioridad === 'critica');
  const hasUnread = unreadNotifications.length > 0;
  const bellColor = hasRed ? 'text-red-500' : hasUnread ? 'text-yellow-500' : 'text-muted-foreground';
  const dotColor = hasRed ? 'bg-red-500' : 'bg-yellow-500';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full hover:bg-muted/50"
          title="Notificaciones"
        >
          <Bell className={`h-6 w-6 ${bellColor}`} />

          {/* Pulsing dot when there are unread notifications */}
          {hasUnread && (
            <span className={`absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ${dotColor}`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(320px,calc(100vw-2rem))] p-4">
        <div className="grid gap-4">
          {/* Header - solo cuando hay notificaciones */}
          {unreadNotifications.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Resumen de Notificaciones</h4>
              <p className="text-sm text-muted-foreground">
                Tienes {unreadNotifications.length} alerta(s) pendiente(s).
              </p>
            </div>
          )}

          {/* Summary */}
          {unreadNotifications.length > 0 ? (
            <div className="grid gap-2">
              {/* Ventas por vencer */}
              {ventasPorVencer > 0 && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="col-span-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Ventas por vencer</span>
                  </span>
                  <span className="text-right text-sm">{ventasPorVencer}</span>
                </div>
              )}

              {/* Servicios por pagar */}
              {serviciosPorPagar > 0 && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="col-span-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Servicios por pagar</span>
                  </span>
                  <span className="text-right text-sm">{serviciosPorPagar}</span>
                </div>
              )}

              {/* Servicios en reposo */}
              {reposoCompletados > 0 && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="col-span-2 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Servicios en reposo</span>
                  </span>
                  <span className="text-right text-sm">{reposoCompletados}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2 py-4">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground" />
              <h4 className="font-medium leading-none">Todo al día</h4>
              <p className="text-sm text-muted-foreground">No tienes notificaciones pendientes.</p>
            </div>
          )}

          {/* Footer - Ver todas */}
          {unreadNotifications.length > 0 && (
            <a
              href="/notificaciones"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              onClick={() => setIsOpen(false)}
            >
              Ver todas las notificaciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
