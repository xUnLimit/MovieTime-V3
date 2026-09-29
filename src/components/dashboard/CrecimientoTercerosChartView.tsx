import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

import { chartColors, chartInitialDimension } from "./chart-theme";
import type { CrecimientoVista } from "./crecimiento-terceros-config";
import type {
  BalancePoint,
  ChurnPoint,
  CrecimientoPeriod,
  TercerosGrowthPoint,
} from "./crecimiento-terceros-helpers";
import {
  BaseLegend,
  BaseTooltip,
  BaseXAxis,
  BaseYAxis,
  EmptyChartMessage,
  gridColor,
  renderChurnLabel,
} from "./crecimiento-terceros-chart-primitives";

interface CrecimientoTercerosChartViewProps {
  animationClass: string;
  balanceData: BalancePoint[];
  churnData: ChurnPoint[];
  data: TercerosGrowthPoint[];
  isLoading: boolean;
  selectedPeriod: CrecimientoPeriod;
  vista: CrecimientoVista;
}

export function CrecimientoTercerosChartView({
  animationClass,
  balanceData,
  churnData,
  data,
  isLoading,
  selectedPeriod,
  vista,
}: CrecimientoTercerosChartViewProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-lg" />;
  }

  return (
    <div
      className={`h-full w-full transition-all duration-200 ease-out will-change-transform ${animationClass}`}
    >
      {vista.id === "crecimiento" ? (
        <GrowthChart data={data} selectedPeriod={selectedPeriod} />
      ) : vista.id === "bajas" && churnData.length === 0 ? (
        <EmptyChartMessage message="No hay bajas disponibles" />
      ) : vista.id === "bajas" ? (
        <ChurnChart data={churnData} />
      ) : balanceData.length === 0 ? (
        <EmptyChartMessage message="No hay datos de balance disponibles" />
      ) : (
        <BalanceChart data={balanceData} />
      )}
    </div>
  );
}

function GrowthChart({
  data,
  selectedPeriod,
}: {
  data: TercerosGrowthPoint[];
  selectedPeriod: CrecimientoPeriod;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorClientes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.clients} stopOpacity={0.22} />
            <stop offset="100%" stopColor={chartColors.clients} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRevendedores" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.resellers} stopOpacity={0.2} />
            <stop offset="100%" stopColor={chartColors.resellers} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <BaseXAxis
          dataKey="dia"
          interval={selectedPeriod === "actual" ? 1 : 0}
        />
        <BaseYAxis />
        <BaseTooltip
          formatter={(value, name) => {
            const displayValue = value ?? 0;
            if (name === "clientes") return [displayValue, "Clientes"];
            if (name === "revendedores") {
              return [displayValue, "Revendedores"];
            }
            return [displayValue, name ?? ""];
          }}
        />
        <BaseLegend />
        <Area
          type="monotone"
          dataKey="clientes"
          stroke={chartColors.clients}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorClientes)"
          name="Clientes"
          animationDuration={600}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="revendedores"
          stroke={chartColors.resellers}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRevendedores)"
          name="Revendedores"
          animationDuration={600}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChurnChart({ data }: { data: ChurnPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
      <BarChart data={data} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <BaseXAxis dataKey="mes" interval={0} />
        <BaseYAxis />
        <BaseTooltip
          formatter={(value, name) => {
            const displayValue = value ?? 0;
            if (name === "perdidos") {
              return [displayValue, "Clientes perdidos"];
            }
            if (name === "churnPct") {
              return [`${Number(displayValue).toFixed(2)}%`, "Churn"];
            }
            if (name === "activosInicio") {
              return [displayValue, "Activos al inicio"];
            }
            return [displayValue, name ?? ""];
          }}
        />
        <Bar
          dataKey="perdidos"
          fill={chartColors.loss}
          radius={[6, 6, 0, 0]}
          name="Clientes perdidos"
          animationDuration={900}
          animationEasing="ease-out"
        >
          <LabelList dataKey="churnPct" content={renderChurnLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BalanceChart({ data }: { data: BalancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
      <BarChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <BaseXAxis dataKey="mes" interval={0} />
        <BaseYAxis />
        <BaseTooltip
          formatter={(value, name) => {
            const displayValue = value ?? 0;
            if (name === "ganados") return [displayValue, "Terceros ganados"];
            if (name === "perdidos") return [displayValue, "Bajas registradas"];
            return [displayValue, name ?? ""];
          }}
        />
        <BaseLegend />
        <Bar
          dataKey="ganados"
          fill={chartColors.gain}
          radius={[6, 6, 0, 0]}
          name="Ganados"
          animationDuration={900}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="perdidos"
          fill={chartColors.loss}
          radius={[6, 6, 0, 0]}
          name="Perdidos"
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
