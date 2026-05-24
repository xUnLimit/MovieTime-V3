import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

import type { CrecimientoVista } from "./crecimiento-terceros-config";
import type { CrecimientoPeriod } from "./crecimiento-terceros-helpers";

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

const axisColor = "var(--muted-foreground)";
const gridColor = "var(--border)";
const tooltipBg = "var(--background)";
const tooltipBorder = "var(--border)";
const tooltipText = "var(--foreground)";

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

function BaseXAxis({
  dataKey,
  interval,
}: {
  dataKey: string;
  interval: number;
}) {
  return (
    <XAxis
      dataKey={dataKey}
      stroke={axisColor}
      fontSize={10}
      tickLine={false}
      axisLine={false}
      dy={8}
      tick={{ fill: axisColor }}
      interval={interval}
    />
  );
}

function BaseYAxis() {
  return (
    <YAxis
      stroke={axisColor}
      fontSize={10}
      tickLine={false}
      axisLine={false}
      allowDecimals={false}
      domain={[0, "auto"]}
      width={35}
      tick={{ fill: axisColor }}
    />
  );
}

function BaseTooltip({
  formatter,
}: {
  formatter: (
    value: number | undefined,
    name: string | undefined,
  ) => [number | string, string];
}) {
  return (
    <Tooltip
      contentStyle={{
        backgroundColor: tooltipBg,
        border: `1px solid ${tooltipBorder}`,
        borderRadius: "8px",
      }}
      formatter={formatter}
      labelFormatter={(label, payload) => {
        if (payload && payload.length > 0) {
          const dateStr = payload[0].payload.fullDate;
          return dateStr
            ? dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
            : label;
        }
        return label;
      }}
      labelStyle={{ color: tooltipText }}
      animationDuration={0}
    />
  );
}

function BaseLegend() {
  return (
    <Legend
      verticalAlign="bottom"
      height={30}
      iconType="circle"
      wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
    />
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function renderChurnLabel(props: LabelProps) {
  const xNum = Number(props.x);
  const yNum = Number(props.y);
  const widthNum = Number(props.width);
  const value = Number(props.value ?? 0);

  if (
    !Number.isFinite(xNum) ||
    !Number.isFinite(yNum) ||
    !Number.isFinite(widthNum) ||
    value <= 0
  ) {
    return null;
  }

  return (
    <text
      x={xNum + widthNum / 2}
      y={yNum - 6}
      fill="#dc2626"
      stroke={tooltipBg}
      strokeWidth={3}
      paintOrder="stroke"
      fontSize={11}
      fontWeight={700}
      textAnchor="middle"
    >
      {`${value.toFixed(1)}%`}
    </text>
  );
}
