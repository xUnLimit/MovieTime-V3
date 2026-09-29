import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Tone } from '@/components/shared/tone';
import { cn } from '@/platform/utils';
import type { ChannelStatus as Status } from '@/modules/messaging/meta-template-mapping';

const META: Record<Status, { dot: string; tone: Tone; label: string; hint: string }> = {
  api: { dot: 'bg-success', tone: 'success', label: 'Automático', hint: 'Plantilla de Meta aprobada: se envía sola por la API' },
  pending: { dot: 'bg-warning', tone: 'warning', label: 'En revisión', hint: 'Plantilla vinculada, Meta aún no la aprueba' },
  wame: { dot: 'bg-muted-foreground/50', tone: 'neutral', label: 'Manual', hint: 'Sin plantilla de Meta: se envía a mano por wa.me' },
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

export function ChannelChip({ status }: { status: Status }) {
  return (
    <StatusBadge tone={META[status].tone} title={META[status].hint}>
      {META[status].label}
    </StatusBadge>
  );
}

export function ChannelLegend() {
  return (
    <ul className="space-y-1 px-2 text-xs text-muted-foreground" aria-hidden>
      {(['api', 'pending', 'wame'] as const).map((status) => (
        <li key={status} className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', META[status].dot)} />
          {META[status].hint}
        </li>
      ))}
    </ul>
  );
}
