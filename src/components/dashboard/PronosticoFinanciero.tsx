'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronLeft, ChevronRight, Lightbulb, TrendingUp, TrendingDown } from 'lucide-react';
import { usePronosticoFinanciero, type MesPronostico } from '@/hooks/use-pronostico-financiero';

function MesRowSkeleton() {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 relative">
      <div className="absolute top-2 right-2">
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <Skeleton className="h-5 w-24 mb-1.5" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
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
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 relative">
      <div className="absolute top-2 right-2">
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            isPositive
              ? 'text-green-500 bg-green-500/10'
              : 'text-red-500 bg-red-500/10'
          }`}
        >
          {isPositive ? 'Ganancia' : 'P\u00e9rdida'}: {formatUSD(mes.ganancias)}
        </span>
      </div>

      <p className="text-sm font-medium mb-1.5 pr-24">{mes.mes}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-green-500">~{formatUSD(mes.ingresos)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-500">~{formatUSD(mes.gastos)}</span>
        </div>
      </div>
    </div>
  );
}

export function PronosticoFinanciero() {
  const { meses, isLoading } = usePronosticoFinanciero({ endAtCurrentYear: true });
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
    <Card className="flex flex-col py-3 gap-0 h-full overflow-hidden">
      <CardHeader className="p-0 px-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
              <CardTitle className="text-base">{'Pron\u00f3stico Financiero'}</CardTitle>
            </div>
            <CardDescription className="text-sm mt-0.5">
              {'Proyecciones para los pr\u00f3ximos meses.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {totalPaginas > 1 && (
              <span className="text-[11px] tabular-nums text-muted-foreground px-1">
                {paginaVisible + 1}/{totalPaginas}
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => navegar(-1)}
              disabled={!puedeIrAtras || isLoading || animacionFase !== 'idle'}
              aria-label="Ver bloque anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => navegar(1)}
              disabled={!puedeIrAdelante || isLoading || animacionFase !== 'idle'}
              aria-label="Ver siguiente bloque"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-0 flex-1 space-y-2 overflow-y-auto min-h-0">
        {isLoading ? (
          <>
            <MesRowSkeleton />
            <MesRowSkeleton />
            <MesRowSkeleton />
            <MesRowSkeleton />
          </>
        ) : meses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos suficientes para proyectar.
          </p>
        ) : (
          <div className={`space-y-2 transition-all duration-200 ease-out will-change-transform ${animationClass}`}>
            {mesesVisibles.map((mes) => <MesRow key={mes.mesKey} mes={mes} />)}
          </div>
        )}
      </CardContent>

      <CardFooter className="px-4 pt-3 pb-1 mt-auto">
        <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 w-full min-h-[52px]">
          <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          {isLoading ? (
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {'Basado en renovaciones y pagos recurrentes, se muestra la proyecci\u00f3n esparada de ingresos, gastos y ganancias.'}
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
