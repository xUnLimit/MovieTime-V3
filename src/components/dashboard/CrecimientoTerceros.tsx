"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { useDashboardHome } from "@/hooks/use-dashboard-home";

import {
  CRECIMIENTO_VISTAS,
  PERIOD_OPTIONS,
} from "./crecimiento-terceros-config";
import {
  buildBalanceData,
  buildChurnData,
  buildTercerosGrowthData,
  type CrecimientoPeriod,
} from "./crecimiento-terceros-helpers";
import { CrecimientoTercerosChartView } from "./CrecimientoTercerosChartView";
import { CrecimientoTercerosHeader } from "./CrecimientoTercerosHeader";

type AnimationPhase = "idle" | "exit" | "enter";
type AnimationDirection = 1 | -1;

export function CrecimientoTerceros() {
  const [selectedPeriod, setSelectedPeriod] =
    useState<CrecimientoPeriod>("actual");
  const [vistaIndex, setVistaIndex] = useState(0);
  const [animacionFase, setAnimacionFase] =
    useState<AnimationPhase>("idle");
  const [animacionDireccion, setAnimacionDireccion] =
    useState<AnimationDirection>(1);
  const animationTimerRef = useRef<number | null>(null);

  const { data: dashboardHome, isLoading } = useDashboardHome();
  const stats = dashboardHome?.stats;
  const vista = CRECIMIENTO_VISTAS[vistaIndex];
  const totalVistas = CRECIMIENTO_VISTAS.length;
  const puedeIrAtras = vistaIndex > 0;
  const puedeIrAdelante = vistaIndex < totalVistas - 1;
  const selectedPeriodLabel =
    PERIOD_OPTIONS.find((option) => option.value === selectedPeriod)?.label ??
    "Mes actual";

  const data = useMemo(() => {
    return buildTercerosGrowthData({
      selectedPeriod,
      tercerosPorDia: stats?.tercerosPorDia ?? [],
      tercerosPorMes: stats?.tercerosPorMes ?? [],
    });
  }, [selectedPeriod, stats]);

  const churnData = useMemo(() => {
    return buildChurnData(stats?.churnStats?.porMes ?? []);
  }, [stats]);

  const balanceData = useMemo(() => {
    return buildBalanceData({
      tercerosPorMes: stats?.tercerosPorMes ?? [],
      churnPorMes: stats?.churnStats?.porMes ?? [],
    });
  }, [stats]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const navegar = (direction: AnimationDirection) => {
    if (animacionFase !== "idle") return;
    const siguienteIndex = vistaIndex + direction;
    if (siguienteIndex < 0 || siguienteIndex >= totalVistas) return;

    setAnimacionDireccion(direction);
    setAnimacionFase("exit");

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setVistaIndex(siguienteIndex);
      setAnimacionFase("enter");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setAnimacionFase("idle");
        });
      });
    }, 180);
  };

  return (
    <Card className="py-1">
      <CrecimientoTercerosHeader
        animacionIdle={animacionFase === "idle"}
        isLoading={isLoading}
        puedeIrAdelante={puedeIrAdelante}
        puedeIrAtras={puedeIrAtras}
        selectedPeriod={selectedPeriod}
        selectedPeriodLabel={selectedPeriodLabel}
        totalVistas={totalVistas}
        vista={vista}
        vistaIndex={vistaIndex}
        navegar={navegar}
        setSelectedPeriod={setSelectedPeriod}
      />
      <CardContent className="pt-0 px-6 pb-2">
        <CrecimientoTercerosChartView
          animationClass={getAnimationClass(animacionFase, animacionDireccion)}
          balanceData={balanceData}
          churnData={churnData}
          data={data}
          isLoading={isLoading}
          selectedPeriod={selectedPeriod}
          vista={vista}
        />
      </CardContent>
    </Card>
  );
}

function getAnimationClass(
  animacionFase: AnimationPhase,
  animacionDireccion: AnimationDirection,
) {
  if (animacionFase === "exit") {
    return animacionDireccion === 1
      ? "-translate-x-3 opacity-0"
      : "translate-x-3 opacity-0";
  }
  if (animacionFase === "enter") {
    return animacionDireccion === 1
      ? "translate-x-3 opacity-0"
      : "-translate-x-3 opacity-0";
  }
  return "translate-x-0 opacity-100";
}
