import { Legend, Tooltip, XAxis, YAxis } from "recharts";
import type { LabelProps } from "recharts";

export const axisColor = "var(--muted-foreground)";
export const gridColor = "var(--border)";
const tooltipBg = "var(--background)";
const tooltipBorder = "var(--border)";
const tooltipText = "var(--foreground)";

export function BaseXAxis({
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

export function BaseYAxis() {
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

export function BaseTooltip({
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

export function BaseLegend() {
  return (
    <Legend
      verticalAlign="bottom"
      height={30}
      iconType="circle"
      wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
    />
  );
}

export function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function renderChurnLabel(props: LabelProps) {
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
