import { cn } from '@/platform/utils';
import type { ChannelStatus as Status } from '@/modules/messaging/meta-template-mapping';

const META: Record<Status, { dot: string; label: string; hint: string }> = {
  api: { dot: 'bg-success', label: 'Automático', hint: 'Plantilla de Meta aprobada: se envía sola por la API' },
  pending: { dot: 'bg-warning', label: 'En revisión', hint: 'Plantilla vinculada, Meta aún no la aprueba' },
  wame: { dot: 'bg-muted-foreground/50', label: 'Manual', hint: 'Sin plantilla de Meta: se envía a mano por wa.me' },
};

export function channelLabel(status: Status) {
  return META[status].label;
}

export function ChannelDot({ status }: { status: Status }) {
  return (
    <span data-testid="channel-dot" data-status={status} className="inline-flex shrink-0 items-center">
      <span aria-hidden className={cn('size-2 rounded-full', META[status].dot)} />
      <span className="sr-only">{META[status].label}</span>
    </span>
  );
}

/** Punto de estado decorativo (el texto del estado lo da quien lo usa). */
export function ChannelPip({ status }: { status: Status }) {
  return <span aria-hidden className={cn('size-2 rounded-full', META[status].dot)} />;
}

export function ChannelLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
      {(['api', 'pending', 'wame'] as const).map((status) => (
        <li key={status} title={META[status].hint} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', META[status].dot)} />
          {META[status].label}
        </li>
      ))}
    </ul>
  );
}
