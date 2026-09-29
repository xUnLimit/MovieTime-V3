'use client';

import { useRef, useState } from 'react';
import { Bell, ShoppingCart, Banknote, Pause, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import {
  esNotificacionReposo,
  esNotificacionServicio,
  esNotificacionVenta,
} from '@/types/notificaciones';

type NotificationSummary = {
  today: number;
  overdue: number;
  upcoming: number;
  highlighted: number;
};

type ReposoSummary = {
  inProgress: number;
  endingSoon: number;
  completed: number;
};

type MetricTone = 'today' | 'overdue' | 'upcoming' | 'completed' | 'info' | 'highlighted';

type SummaryMetric = {
  label: string;
  value: number;
  tone: MetricTone;
};

type SummaryIcon = typeof ShoppingCart;

function getNotificationSummary<T extends { diasRestantes: number; resaltada: boolean }>(
  items: T[]
): NotificationSummary {
  return {
    today: items.filter((item) => item.diasRestantes === 0).length,
    overdue: items.filter((item) => item.diasRestantes < 0).length,
    upcoming: items.filter((item) => item.diasRestantes > 0).length,
    highlighted: items.filter((item) => item.resaltada).length,
  };
}

function getReposoSummary<T extends { diasRestantes: number; resaltada: boolean }>(
  items: T[]
): ReposoSummary {
  return (
    {
      inProgress: items.filter((item) => item.diasRestantes > 7).length,
      endingSoon: items.filter((item) => item.diasRestantes > 0 && item.diasRestantes <= 7).length,
      completed: items.filter((item) => item.diasRestantes <= 0).length,
    }
  );
}

function getNotificationMetrics(summary: NotificationSummary): SummaryMetric[] {
  return [
    { label: 'Hoy', value: summary.today, tone: 'today' },
    { label: 'Retrasados', value: summary.overdue, tone: 'overdue' },
    { label: 'Proximos', value: summary.upcoming, tone: 'upcoming' },
    { label: 'Resaltados', value: summary.highlighted, tone: 'highlighted' },
  ];
}

function getReposoMetrics(summary: ReposoSummary): SummaryMetric[] {
  return [
    { label: 'En proceso', value: summary.inProgress, tone: 'info' },
    { label: 'Por finalizar', value: summary.endingSoon, tone: 'upcoming' },
    { label: 'Completados', value: summary.completed, tone: 'completed' },
  ];
}

function hasMetricItems(metrics: SummaryMetric[]) {
  return metrics.some((metric) => metric.value > 0);
}

function SummaryRow({
  icon: Icon,
  label,
  metrics,
  alwaysShow = false,
}: {
  icon: SummaryIcon;
  label: string;
  metrics: SummaryMetric[];
  alwaysShow?: boolean;
}) {
  if (!alwaysShow && !hasMetricItems(metrics)) return null;

  return (
    <div className="grid grid-cols-[minmax(0,82px)_1fr] items-center gap-1.5 rounded-md px-2 py-2 hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-xs font-semibold">{label}</span>
      </div>

      <div
        className={`grid min-w-0 gap-1 text-center ${
          metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
        }`}
      >
        {metrics.map((metric) => (
          <MetricValue
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </div>
    </div>
  );
}

function MetricValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: MetricTone;
}) {
  const valueClass =
    value === 0
      ? 'text-muted-foreground'
      : tone === 'today' || tone === 'overdue'
        ? 'text-danger'
        : tone === 'upcoming'
          ? 'text-warning'
          : tone === 'completed'
            ? 'text-success'
            : tone === 'info'
              ? 'text-info'
              : 'text-warning';

  return (
    <div className="min-w-0">
      <div className={`text-sm font-semibold leading-4 tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-0.5 whitespace-normal break-words text-xs leading-[10px] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { data: notificaciones = [] } = useNotificaciones();
  const [isOpen, setIsOpen] = useState(false);
  const closeWasPointerDrivenRef = useRef(false);

  const ventasSummary = getNotificationSummary(notificaciones.filter(esNotificacionVenta));
  const serviciosSummary = getNotificationSummary(notificaciones.filter(esNotificacionServicio));
  const reposoSummary = getReposoSummary(notificaciones.filter(esNotificacionReposo));
  const ventasMetrics = getNotificationMetrics(ventasSummary);
  const serviciosMetrics = getNotificationMetrics(serviciosSummary);
  const reposoMetrics = getReposoMetrics(reposoSummary);

  const summaries = [ventasSummary, serviciosSummary];
  const hasOverdue = summaries.some((summary) => summary.overdue > 0);
  const hasToday = summaries.some((summary) => summary.today > 0);
  const hasUpcoming = summaries.some((summary) => summary.upcoming > 0);
  const hasCompletedReposo = reposoSummary.completed > 0;
  const hasEndingReposo = reposoSummary.endingSoon > 0;
  const hasReposoInProgress = reposoSummary.inProgress > 0;
  const hasHighlighted = summaries.some((summary) => summary.highlighted > 0);
  const hasRelevantNotifications =
    hasOverdue ||
    hasToday ||
    hasUpcoming ||
    hasCompletedReposo ||
    hasEndingReposo ||
    hasReposoInProgress ||
    hasHighlighted;
  const bellColor = hasOverdue || hasToday
    ? 'text-danger'
    : hasCompletedReposo
      ? 'text-success'
    : hasHighlighted
      ? 'text-warning'
      : hasUpcoming || hasEndingReposo
        ? 'text-warning'
        : hasReposoInProgress
          ? 'text-info'
        : 'text-muted-foreground';
  const dotColor =
    hasOverdue || hasToday
      ? 'bg-danger'
      : hasCompletedReposo
        ? 'bg-success'
        : hasHighlighted
          ? 'bg-warning'
          : hasUpcoming || hasEndingReposo
            ? 'bg-warning'
            : 'bg-info';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full hover:bg-transparent focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-muted-foreground/30 [@media(hover:hover)]:hover:bg-muted/50"
          aria-label="Abrir notificaciones"
          title="Notificaciones"
          onPointerDown={() => {
            closeWasPointerDrivenRef.current = true;
          }}
          onKeyDown={() => {
            closeWasPointerDrivenRef.current = false;
          }}
        >
          <Bell className={`h-6 w-6 ${bellColor}`} />

          {hasRelevantNotifications && (
            <span className={`absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ${dotColor}`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(400px,calc(100vw-2rem))] p-2"
        onPointerDownCapture={() => {
          closeWasPointerDrivenRef.current = true;
        }}
        onKeyDownCapture={() => {
          closeWasPointerDrivenRef.current = false;
        }}
        onInteractOutside={() => {
          closeWasPointerDrivenRef.current = true;
        }}
        onEscapeKeyDown={() => {
          closeWasPointerDrivenRef.current = false;
        }}
        onCloseAutoFocus={(event) => {
          if (!closeWasPointerDrivenRef.current) return;

          event.preventDefault();
          closeWasPointerDrivenRef.current = false;
        }}
      >
        <div className="grid gap-2">
          {hasRelevantNotifications ? (
            <>
              <div className="px-1.5 py-1">
                <h4 className="text-sm font-medium leading-none">Notificaciones</h4>
                <p className="mt-0.5 text-xs leading-3 text-muted-foreground">
                  Ventas, servicios y reposo con sus estados actuales.
                </p>
              </div>

              <div className="grid divide-y divide-border rounded-md border bg-background/40">
                <SummaryRow icon={ShoppingCart} label="Ventas" metrics={ventasMetrics} />
                <SummaryRow icon={Banknote} label="Servicios" metrics={serviciosMetrics} />
                <SummaryRow icon={Pause} label="Reposo" metrics={reposoMetrics} alwaysShow />
              </div>

              <a
                href="/notificaciones"
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => setIsOpen(false)}
              >
                Ver todas las notificaciones
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <div className="space-y-2 py-4 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
              <h4 className="font-medium leading-none">Todo al dia</h4>
              <p className="text-sm text-muted-foreground">
                No tienes notificaciones relevantes para ventas, servicios o reposo.
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
