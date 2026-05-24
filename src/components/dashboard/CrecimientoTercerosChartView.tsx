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

import type { CrecimientoVista } from "./crecimiento-terceros-config";
import type { CrecimientoPeriod } from "./crecimiento-terceros-helpers";
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
  balanceData: Array<Record<string, unknown>>;
  churnData: Array<Record<string, unknown>>;
  data: Array<Record<string, unknown>>;
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
    return <Skeleton className="w-full h-[240px] rounded-lg" />;
  }

  return (
    <div
      className={`w-full h-[240px] transition-all duration-200 ease-out will-change-transform ${animationClass}`}
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
  data: Array<Record<string, unknown>>;
  selectedPeriod: CrecimientoPeriod;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorClientes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
            <stop offset="50%" stopColor="#1e40af" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="colorRevendedores" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
            <stop offset="50%" stopColor="#be185d" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#4a0d25" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
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
          stroke="#2563eb"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorClientes)"
          name="Clientes"
          animationDuration={1000}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="revendedores"
          stroke="#ec4899"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRevendedores)"
          name="Revendedores"
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChurnChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
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
          fill="#dc2626"
          radius={[8, 8, 0, 0]}
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

function BalanceChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
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
          fill="#16a34a"
          radius={[8, 8, 0, 0]}
          name="Ganados"
          animationDuration={900}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="perdidos"
          fill="#dc2626"
          radius={[8, 8, 0, 0]}
          name="Perdidos"
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
