'use client';

import { memo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/platform/utils';

import { useMetricStrip } from './MetricGrid';
import { toneText, type Tone } from './tone';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  /** Tono del icono. Usalo solo cuando el estado importa; por defecto es neutro. */
  tone?: Tone;
  /** Tono del valor (p. ej. ganancia positiva/negativa). */
  valueTone?: Tone;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  className?: string;
}

export const MetricCard = memo(function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  valueTone,
  trend,
  loading = false,
  className,
}: MetricCardProps) {
  const flat = useMetricStrip();

  return (
    <Card
      data-slot="metric-card"
      data-tone={tone}
      aria-busy={loading || undefined}
      className={cn(
        'gap-0.5 py-3.5',
        flat && 'rounded-none border-0 border-r border-b bg-transparent',
        className
      )}
    >
      <div className="px-4">
        {loading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span title={title} className="block truncate text-sm font-medium text-muted-foreground">{title}</span>
        )}
      </div>
      <div className="px-4">
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className={cn('truncate text-xl leading-7 font-semibold tracking-tight tabular-nums', valueTone && toneText[valueTone])}>
              {value}
            </div>
            {Icon ? <Icon aria-hidden className={cn('size-4 shrink-0', toneText[tone])} /> : null}
          </div>
        )}
        {description ? (
          loading ? (
            <Skeleton className="mt-1 h-3 w-40" />
          ) : (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
          )
        ) : null}
        {trend && !loading ? (
          <span
            className={cn(
              'mt-1 flex items-center text-xs font-medium tabular-nums',
              trend.isPositive ? toneText.success : toneText.danger
            )}
          >
            {trend.isPositive ? <TrendingUp aria-hidden className="mr-1 size-3" /> : <TrendingDown aria-hidden className="mr-1 size-3" />}
            {Math.abs(trend.value)}%
          </span>
        ) : null}
      </div>
    </Card>
  );
});
