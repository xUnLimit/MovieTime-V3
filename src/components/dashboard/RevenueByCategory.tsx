'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PagerControls } from '@/components/shared/PagerControls';
import { Panel } from '@/components/shared/Panel';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardHome } from '@/hooks/use-dashboard-home';
import {
  getValueDomain,
  MIN_NEGATIVE_AXIS_RATIO,
  MIN_NEGATIVE_AXIS_RATIO_MOBILE,
  REVENUE_CATEGORY_VIEWS,
  useIsCompactChart,
} from './revenue-by-category-helpers';
import { RevenueByCategoryChart } from './RevenueByCategoryChart';

export function RevenueByCategory() {
  const { data: dashboardHome, isLoading } = useDashboardHome();
  const stats = dashboardHome?.stats;
  const { selectedYear } = useDashboardFilterStore();
  const isCompactChart = useIsCompactChart();

  const [vistaIndex, setVistaIndex] = useState(0);
  const [animacionFase, setAnimacionFase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [animacionDireccion, setAnimacionDireccion] = useState<1 | -1>(1);
  const animationTimerRef = useRef<number | null>(null);

  const vista = REVENUE_CATEGORY_VIEWS[vistaIndex];
  const totalVistas = REVENUE_CATEGORY_VIEWS.length;
  const puedeIrAtras = vistaIndex > 0;
  const puedeIrAdelante = vistaIndex < totalVistas - 1;

  const { data, hasData } = useMemo(() => {
    const cutoff = `${selectedYear}-01`;
    const porMes = stats?.ingresosCategoriasPorMes ?? [];

    const totalesPorCategoria = new Map<string, { nombre: string; total: number; gastos: number }>();
    const filteredMeses = porMes.filter((e) => e.mes >= cutoff);

    if (filteredMeses.length > 0) {
      for (const entry of filteredMeses) {
        const existing = totalesPorCategoria.get(entry.categoriaId);
        if (existing) {
          existing.total += entry.total;
          existing.gastos += entry.gastos;
        } else {
          totalesPorCategoria.set(entry.categoriaId, {
            nombre: entry.nombre,
            total: entry.total,
            gastos: entry.gastos,
          });
        }
      }
    } else {
      for (const c of (stats?.ingresosPorCategoria ?? [])) {
        totalesPorCategoria.set(c.categoriaId, {
          nombre: c.nombre,
          total: c.total,
          gastos: c.gastos ?? 0,
        });
      }
    }

    const mapped = Array.from(totalesPorCategoria.values()).map((c) => {
      const ganancia = c.total - c.gastos;
      const margen = c.total > 0 ? (ganancia / c.total) * 100 : 0;
      return {
        categoria: c.nombre,
        ganancia: Math.round(ganancia),
        margen: Math.round(margen * 10) / 10,
        ingresos: c.total,
      };
    });

    const valor = vista.id === 'ganancia' ? 'ganancia' : 'margen';
    const filtered = mapped
      .filter((c) => c.ingresos > 0 && c[valor] !== 0)
      .map((c) => ({ ...c, valor: c[valor] }));
    const hasData = filtered.length > 0;
    const data = filtered.sort((a, b) => b.valor - a.valor);
    return { data, hasData };
  }, [stats, selectedYear, vista]);

  const valueDomain = useMemo(
    () => getValueDomain(data, isCompactChart ? MIN_NEGATIVE_AXIS_RATIO_MOBILE : MIN_NEGATIVE_AXIS_RATIO),
    [data, isCompactChart]
  );
  const chartMargin = isCompactChart
    ? { left: 0, right: 34, top: 8, bottom: 0 }
    : { left: 0, right: 50, top: 5, bottom: 5 };
  const yAxisWidth = isCompactChart ? 88 : 108;
  const yAxisTickMargin = isCompactChart ? 8 : 10;
  const valueLabelFontSize = 12;
  const xAxisTickCount = isCompactChart ? 3 : 5;

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const navegar = (direction: 1 | -1) => {
    if (animacionFase !== 'idle') return;
    const siguienteIndex = vistaIndex + direction;
    if (siguienteIndex < 0 || siguienteIndex >= totalVistas) return;

    setAnimacionDireccion(direction);
    setAnimacionFase('exit');

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setVistaIndex(siguienteIndex);
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
      title={vista.title}
      description={vista.description}
      className="md:h-[324px] lg:h-auto lg:min-h-0"
      contentClassName="min-h-[260px] md:min-h-[200px]"
      fill
      actions={
        <PagerControls
          index={vistaIndex}
          total={totalVistas}
          onPrevious={() => navegar(-1)}
          onNext={() => navegar(1)}
          previousDisabled={!puedeIrAtras || isLoading || animacionFase !== 'idle'}
          nextDisabled={!puedeIrAdelante || isLoading || animacionFase !== 'idle'}
        />
      }
    >
      {isLoading ? (
        <Skeleton className="h-full w-full rounded-lg" />
      ) : !hasData ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        </div>
      ) : (
        <RevenueByCategoryChart
          animationClass={animationClass}
          chartMargin={chartMargin}
          data={data}
          isCompactChart={isCompactChart}
          valueDomain={valueDomain}
          valueLabelFontSize={valueLabelFontSize}
          vista={vista}
          xAxisTickCount={xAxisTickCount}
          yAxisTickMargin={yAxisTickMargin}
          yAxisWidth={yAxisWidth}
        />
      )}
    </Panel>
  );
}
