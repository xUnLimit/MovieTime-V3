'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { PagerControls } from '@/components/shared/PagerControls';
import { Panel } from '@/components/shared/Panel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { usePronosticoFinanciero, type MesPronostico } from '@/hooks/use-pronostico-financiero';

function MesRowSkeleton() {
  return (
    <div className="rounded-lg border px-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function formatUSD(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function MesRow({ mes }: { mes: MesPronostico }) {
  const isPositive = mes.ganancias >= 0;

  return (
    <div className="rounded-lg border px-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{mes.mes}</p>
        <StatusBadge tone={isPositive ? 'success' : 'danger'}>
          {isPositive ? 'Ganancia' : 'Pérdida'}: {formatUSD(mes.ganancias)}
        </StatusBadge>
      </div>
      <dl className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt>Ingresos</dt>
          <dd className="font-medium text-info tabular-nums">~{formatUSD(mes.ingresos)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>Gastos</dt>
          <dd className="font-medium text-danger tabular-nums">~{formatUSD(mes.gastos)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function PronosticoFinanciero() {
  const { meses, isLoading, error, retry } = usePronosticoFinanciero({ endAtCurrentYear: true });
  const [paginaActual, setPaginaActual] = useState(0);
  const [animacionFase, setAnimacionFase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [animacionDireccion, setAnimacionDireccion] = useState<1 | -1>(1);
  const animationTimerRef = useRef<number | null>(null);
  const pageSize = 4;
  const totalPaginas = Math.max(1, Math.ceil(meses.length / pageSize));
  const paginaVisible = Math.min(paginaActual, totalPaginas - 1);
  const puedeIrAtras = paginaVisible > 0;
  const puedeIrAdelante = paginaVisible < totalPaginas - 1;

  const mesesVisibles = useMemo(() => {
    const start = paginaVisible * pageSize;
    return meses.slice(start, start + pageSize);
  }, [meses, paginaVisible]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const navegar = (direction: 1 | -1) => {
    if (animacionFase !== 'idle') return;
    const siguientePagina = paginaVisible + direction;
    if (siguientePagina < 0 || siguientePagina >= totalPaginas) return;

    setAnimacionDireccion(direction);
    setAnimacionFase('exit');

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setPaginaActual(siguientePagina);
      setAnimacionFase('enter');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setAnimacionFase('idle');
        });
      });
    }, 180);
  };

  const animationClass =
    animacionFase === 'exit'
      ? animacionDireccion === 1
        ? '-translate-x-3 opacity-0'
        : 'translate-x-3 opacity-0'
      : animacionFase === 'enter'
        ? animacionDireccion === 1
          ? 'translate-x-3 opacity-0'
          : '-translate-x-3 opacity-0'
        : 'translate-x-0 opacity-100';

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-1.5">
          {'Pronóstico Financiero'}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Cómo se calcula el pronóstico" className="text-muted-foreground">
                <Info />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 text-xs leading-relaxed text-muted-foreground">
              {'Basado en renovaciones y gastos recurrentes, se muestra el pronóstico esperado de ingresos, gastos y ganancias.'}
            </PopoverContent>
          </Popover>
        </span>
      }
      description={'Proyecciones para los próximos meses.'}
      className="min-h-0 flex-1"
      contentClassName="space-y-1.5 overflow-y-auto"
      actions={
        <PagerControls
          index={paginaVisible}
          total={totalPaginas}
          onPrevious={() => navegar(-1)}
          onNext={() => navegar(1)}
          previousDisabled={!puedeIrAtras || isLoading || animacionFase !== 'idle'}
          nextDisabled={!puedeIrAdelante || isLoading || animacionFase !== 'idle'}
          previousLabel="Ver bloque anterior"
          nextLabel="Ver siguiente bloque"
        />
      }
    >
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-warning-border bg-warning-subtle px-4 py-6 text-center">
          <TriangleAlert aria-hidden className="size-5 text-warning" />
          <p className="text-sm text-foreground">
            No se puede calcular el pronóstico con una tasa de cambio segura.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <>
          <MesRowSkeleton />
          <MesRowSkeleton />
          <MesRowSkeleton />
          <MesRowSkeleton />
        </>
      ) : meses.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay datos suficientes para proyectar.
        </p>
      ) : (
        <div className={`space-y-1.5 transition-[transform,opacity] duration-200 ease-out will-change-transform ${animationClass}`}>
          {mesesVisibles.map((mes) => <MesRow key={mes.mesKey} mes={mes} />)}
        </div>
      )}
    </Panel>
  );
}
