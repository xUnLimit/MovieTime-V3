'use client';

import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotParams } from '@/types/bot';
import { useParamInput } from './use-param-input';

type ParamCardProps = {
  paramKey: keyof BotParams;
  /** Valor del borrador. */
  value: number;
  /** Valor publicado: si difiere, la tarjeta se marca como cambiada y dice cuál era. */
  published: number | undefined;
  /** Problema de validación del borrador para este ajuste. */
  issue?: string;
  onChange: (value: number) => void;
};

/** Un ajuste numérico como tarjeta: qué hace, su valor con unidad y dónde cae dentro del rango permitido. */
export function ParamCard({ paramKey, value, published, issue, onChange }: ParamCardProps) {
  const input = useParamInput(paramKey, value, onChange);
  const { spec } = input;
  const inputId = useId();
  const hintId = useId();
  const changed = published !== undefined && published !== value;
  const position = Math.round(((Math.min(spec.max, Math.max(spec.min, value)) - spec.min) / (spec.max - spec.min)) * 100);
  const message = input.problem ?? issue ?? null;
  return <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">{spec.label}</label>
        {changed ? <StatusBadge tone="info">Cambiado</StatusBadge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{spec.description}</p>
    </div>
    <div className="flex items-center gap-2">
      <Input id={inputId} type="text" inputMode="numeric" autoComplete="off" className="w-24 text-right tabular-nums" value={input.shown} aria-invalid={message !== null} aria-describedby={hintId}
        onChange={(event) => input.setText(event.target.value)} onBlur={input.commit}
        onKeyDown={(event) => { if (event.key === 'Enter') input.commit(); if (event.key === 'Escape') input.cancel(); }} />
      <span className="text-sm text-muted-foreground">{spec.unit}</span>
      {value !== spec.defaultValue
        ? <Button type="button" variant="ghost" size="icon-sm" aria-label={`Restablecer «${spec.label}» a ${spec.defaultValue}`} title={`Predeterminado: ${spec.defaultValue}`} onClick={input.reset}><RotateCcw /></Button>
        : null}
    </div>
    <div aria-hidden className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${position}%` }} /></div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums"><span>{spec.min}</span><span>{spec.max} {spec.unit}</span></div>
    </div>
    <p id={hintId} role={message ? 'alert' : undefined} className={message ? 'text-xs text-danger' : 'text-xs text-muted-foreground'}>
      {message ?? (changed ? `Publicado: ${published} ${spec.unit}` : `Predeterminado: ${spec.defaultValue} ${spec.unit}`)}
    </p>
  </div>;
}
