"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell } from "lucide-react";
import { toast } from "sonner";

import type { NotificacionConId } from "@/hooks/use-notificaciones";
import { queryKeys } from "@/platform/query-keys";
import { queryNotificationsUseCase } from "@/lib/use-cases/notificaciones/notificaciones-query-use-cases";
import { esNotificacionServicio, esNotificacionVenta } from "@/types/notificaciones";

declare global {
  var __movietimeDashboardToastState: "idle" | "pending" | "shown" | undefined;
}

const DASHBOARD_TOAST_SESSION_KEY = "movietime:dashboard-toast-state";

function getDashboardToastSessionState() {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.sessionStorage.getItem(DASHBOARD_TOAST_SESSION_KEY);
    return value === "shown" ? value : undefined;
  } catch {
    return undefined;
  }
}

function setDashboardToastSessionShown() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DASHBOARD_TOAST_SESSION_KEY, "shown");
  } catch {
    // Session storage is a best-effort guard. Runtime state still prevents remount duplicates.
  }
}

function clearDashboardToastSessionState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DASHBOARD_TOAST_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function claimDashboardToastRuntimeSlot() {
  if (globalThis.__movietimeDashboardToastState && globalThis.__movietimeDashboardToastState !== "idle") {
    return false;
  }
  if (getDashboardToastSessionState() === "shown") {
    globalThis.__movietimeDashboardToastState = "shown";
    return false;
  }
  globalThis.__movietimeDashboardToastState = "pending";
  setDashboardToastSessionShown();
  return true;
}

function completeDashboardToastRuntimeSlot() {
  globalThis.__movietimeDashboardToastState = "shown";
  setDashboardToastSessionShown();
}

function releaseDashboardToastRuntimeSlot() {
  globalThis.__movietimeDashboardToastState = "idle";
  clearDashboardToastSessionState();
}

function buildNotificationDescription(unread: NotificacionConId[]) {
  const ventasCount = unread.filter(esNotificacionVenta).length;
  const serviciosCount = unread.filter(esNotificacionServicio).length;
  const parts: string[] = [];

  if (ventasCount > 0) parts.push(`${ventasCount} venta${ventasCount > 1 ? "s" : ""} por vencer`);
  if (serviciosCount > 0) parts.push(`${serviciosCount} servicio${serviciosCount > 1 ? "s" : ""} por pagar`);

  return parts.length > 0
    ? `Tienes ${parts.join(" y ")} que requieren tu atención.`
    : `Tienes ${unread.length} alerta${unread.length > 1 ? "s" : ""} importante${unread.length > 1 ? "s" : ""} que requieren tu atención.`;
}

function showDashboardNotificationToast(unread: NotificacionConId[]) {
  const isRed = unread.some((n) => n.prioridad === "critica");
  const description = buildNotificationDescription(unread);

  toast.custom((t) => (
    <div
      className={[
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg",
        "transition-all",
        isRed
          ? "border-red-200 bg-background dark:border-red-500/30"
          : "border-yellow-200 bg-background dark:border-yellow-500/30",
      ].join(" ")}
    >
      <div className="grid gap-1">
        <div className={`text-sm font-semibold flex items-center gap-2 ${isRed ? "text-red-500" : "text-yellow-500"}`}>
          <Bell className="h-5 w-5" />
          ¡Notificaciones Pendientes!
        </div>
        <div className="text-sm opacity-90 text-foreground">
          {description}
        </div>
      </div>

      <Link
        prefetch={false}
        href="/notificaciones"
        onClick={() => toast.dismiss(t)}
        className={[
          "inline-flex h-8 shrink-0 items-center justify-center self-center rounded-md border bg-transparent px-3",
          "text-sm font-medium ring-offset-background transition-colors",
          "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isRed
            ? "border-red-200 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
            : "border-yellow-200 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-500/30 dark:text-yellow-300 dark:hover:bg-yellow-900",
        ].join(" ")}
      >
        Ver ahora
        <ArrowRight className="ml-1 h-4 w-4" />
      </Link>

      <button
        type="button"
        onClick={() => toast.dismiss(t)}
        className={[
          "absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity",
          "hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
          isRed
            ? "text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-50 focus:ring-red-400"
            : "text-yellow-600 hover:text-yellow-800",
        ].join(" ")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  ), {
    duration: 8000,
    unstyled: true,
    classNames: {
      toast: "!bg-transparent !border-0 !shadow-none !p-0 !rounded-none !gap-0 !flex-none w-full",
    },
  });
}

export function useDashboardNotificationToast() {
  const queryClient = useQueryClient();
  const toastShown = useRef(false);

  useEffect(() => {
    const showWelcomeToast = async () => {
      if (toastShown.current || !claimDashboardToastRuntimeSlot()) return;
      toastShown.current = true;

      let unread: NotificacionConId[] = [];
      try {
        const notificaciones = await queryClient.ensureQueryData({
          queryKey: queryKeys.notificaciones.lists(),
          queryFn: () => queryNotificationsUseCase(),
        });
        unread = notificaciones.filter((n) => !n.leida);
      } catch (error) {
        releaseDashboardToastRuntimeSlot();
        throw error;
      }

      if (unread.length === 0) {
        completeDashboardToastRuntimeSlot();
        return;
      }

      showDashboardNotificationToast(unread);
      completeDashboardToastRuntimeSlot();
    };

    showWelcomeToast().catch((error) => {
      toastShown.current = false;
      console.error("[Dashboard] Error showing notification toast:", error);
    });
  }, [queryClient]);
}
