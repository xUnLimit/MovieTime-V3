import { cn } from '@/platform/utils';
import type { ChannelStatus as Status } from '@/modules/messaging/meta-template-mapping';

const META: Record<Status, { dot: string; label: string; hint: string }> = {
  api: { dot: 'bg-emerald-500', label: 'Por API', hint: 'Plantilla de Meta aprobada' },
  pending: { dot: 'bg-amber-500', label: 'Meta pendiente', hint: 'Plantilla vinculada, aún no enviable' },
  wame: { dot: 'bg-muted-foreground/50', label: 'Solo wa.me', hint: 'Sin plantilla de Meta' },
};

export function channelLabel(status: Status) {
  return META[status].label;
}

export function ChannelDot({ status }: { status: Status }) {
  return (
    <span data-testid="channel-dot" data-status={status} className="inline-flex shrink-0 items-center">
      <span aria-hidden className={cn('h-2 w-2 rounded-full', META[status].dot)} />
      <span className="sr-only">{META[status].label}</span>
    </span>
  );
}

export function ChannelChip({ status }: { status: Status }) {
  return (
    <span
      title={META[status].hint}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
    >
      <span aria-hidden className={cn('h-2 w-2 rounded-full', META[status].dot)} />
      {META[status].label}
    </span>
  );
}

export function ChannelLegend() {
  return (
    <ul className="space-y-1 px-2 text-xs text-muted-foreground" aria-hidden>
      {(['api', 'pending', 'wame'] as const).map((status) => (
        <li key={status} className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', META[status].dot)} />
          {META[status].hint}
        </li>
      ))}
    </ul>
  );
}
