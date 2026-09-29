import { cn } from '@/platform/utils';
import type { ChannelStatus } from '@/modules/messaging/meta-template-mapping';
import { ChannelPip } from './ChannelStatus';

export type SendMode = 'api' | 'wame';

type MethodSwitchProps = {
  mode: SendMode;
  status: ChannelStatus;
  onChange: (mode: SendMode) => void;
};

/** Cambia en el sitio entre escribir el mensaje a mano y vincular la plantilla automatica; editor y celular siguen este valor. */
export function MethodSwitch({ mode, status, onChange }: MethodSwitchProps) {
  const option = (value: SendMode, label: string, pip?: boolean) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {pip ? <ChannelPip status={status} /> : null}
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Cómo se envía este mensaje" className="inline-flex shrink-0 rounded-lg border bg-card p-0.5">
      {option('wame', 'Manual')}
      {option('api', 'Automático', true)}
    </div>
  );
}
