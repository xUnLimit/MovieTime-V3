"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toneText, type Tone } from "@/components/shared/tone";
import { cn } from "@/platform/utils/cn";
import type { NotificacionConId } from "@/hooks/use-notificaciones";
import { reportError } from "@/platform/observability/logger";
import { queryKeys } from "@/platform/query-keys";
import { queryNotificationsUseCase } from "@/application/use-cases/notificaciones/notificaciones-query-use-cases";
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
    ? `Tienes ${parts.join(" y ")}.`
    : `Tienes ${unread.length} alerta${unread.length > 1 ? "s" : ""} importante${unread.length > 1 ? "s" : ""}.`;
}

function showDashboardNotificationToast(unread: NotificacionConId[]) {
  const tone: Tone = unread.some((n) => n.prioridad === "critica") ? "danger" : "warning";
  const description = buildNotificationDescription(unread);

  toast.custom((t) => (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-lg",
        tone === "danger" ? "border-danger-border" : "border-warning-border",
      )}
    >
      <Bell className={cn("mt-0.5 size-4 shrink-0", toneText[tone])} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight tracking-tight">Notificaciones pendientes</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <Button asChild variant="outline" size="xs" className="shrink-0 self-center">
        <Link prefetch={false} href="/notificaciones" onClick={() => toast.dismiss(t)}>
          Ver ahora
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  ), {
    duration: 8000,
    unstyled: true,
    classNames: {
      toast: "!bg-transparent !border-0 !shadow-none !p-0 !rounded-none !gap-0 !flex-none",
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
      reportError("Dashboard", "Error showing notification toast", error);
    });
  }, [queryClient]);
}
