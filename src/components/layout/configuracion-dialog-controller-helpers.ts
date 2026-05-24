import { getExecutivePushDueStatus } from "@/lib/pwa/push-schedule";

interface MonthlyMetric {
  mes: string;
}

interface ExecutivePushStatusConfig {
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  intervalHours: number;
  timezone: string;
  lastSentAt?: Date | null;
}

export function getAvailableDashboardYears(metrics: MonthlyMetric[] = []) {
  const currentYear = new Date().getFullYear();
  const yearsFromData = new Set<number>();

  metrics.forEach(({ mes }) => {
    const year = parseInt(mes.split("-")[0], 10);
    if (!isNaN(year) && year <= currentYear) {
      yearsFromData.add(year);
    }
  });

  yearsFromData.add(currentYear);
  return Array.from(yearsFromData).sort((a, b) => b - a);
}

export function getExecutivePushStatus(executivePush?: ExecutivePushStatusConfig | null) {
  if (!executivePush) return null;

  const due = getExecutivePushDueStatus({
    enabled: executivePush.enabled,
    windowStart: executivePush.windowStart,
    windowEnd: executivePush.windowEnd,
    intervalHours: executivePush.intervalHours,
    timezone: executivePush.timezone,
    lastSentAt: executivePush.lastSentAt,
  });

  if (!executivePush.enabled) {
    return { tone: "muted" as const, label: "Desactivada" };
  }

  if (due.due === false && due.reason === "invalid_time") {
    return { tone: "warning" as const, label: "Ventana invalida" };
  }

  if (due.due === false && due.reason === "invalid_interval") {
    return { tone: "warning" as const, label: "Intervalo invalido" };
  }

  if (executivePush.lastSentAt) {
    const sentAt = executivePush.lastSentAt;
    const timeStr = sentAt.toLocaleTimeString("es-PA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: executivePush.timezone,
    });
    const diffMs = Date.now() - sentAt.getTime();
    const diffMin = Math.max(0, Math.round(diffMs / 60000));
    const ago =
      diffMin < 60 ? `hace ${diffMin} min` : `hace ${Math.round(diffMin / 60)} h`;

    if (due.due === false && due.reason === "interval_not_elapsed") {
      return { tone: "muted" as const, label: `Ultimo envio ${timeStr} (${ago})` };
    }
  }

  if (due.due === false && due.reason === "outside_window") {
    return {
      tone: "muted" as const,
      label: `Fuera de ventana ${executivePush.windowStart}-${executivePush.windowEnd}`,
    };
  }

  return { tone: "pending" as const, label: "Listo para el proximo ciclo del scheduler" };
}
