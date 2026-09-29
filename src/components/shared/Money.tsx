import { cn } from '@/platform/utils';
import { formatearMoneda } from '@/platform/utils/calculations';

import { toneText, type Tone } from './tone';

interface MoneyProps {
  value: number;
  /** Colorea segun el signo: verde si es ganancia, rojo si es perdida. */
  colorBySign?: boolean;
  tone?: Tone;
  className?: string;
}

export function Money({ value, colorBySign = false, tone, className }: MoneyProps) {
  const resolvedTone = tone ?? (colorBySign ? (value < 0 ? 'danger' : 'success') : undefined);

  return (
    <span className={cn('tabular-nums', resolvedTone && toneText[resolvedTone], className)}>
      {formatearMoneda(value)}
    </span>
  );
}
