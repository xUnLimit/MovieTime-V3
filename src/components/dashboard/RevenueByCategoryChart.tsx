import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";

import {
  NEGATIVE_REVENUE_COLOR,
  REVENUE_CATEGORY_COLORS,
  VALUE_LABEL_GAP,
} from "./revenue-by-category-helpers";

interface RevenueCategoryDatum {
  categoria: string;
  valor: number;
}

interface RevenueByCategoryChartProps {
  animationClass: string;
  chartHeight: number;
  chartMargin: { left: number; right: number; top: number; bottom: number };
  data: RevenueCategoryDatum[];
  isCompactChart: boolean;
  valueDomain: [number, number];
  valueLabelFontSize: number;
  vista: {
    id: "ganancia" | "margen";
    tooltipLabel: string;
  };
  xAxisTickCount: number;
  yAxisTickMargin: number;
  yAxisWidth: number;
}

const axisColor = "var(--muted-foreground)";
const labelColor = "var(--foreground)";
const tooltipBg = "var(--background)";
const tooltipBorder = "var(--border)";
const tooltipText = "var(--foreground)";

export function RevenueByCategoryChart({
  animationClass,
  chartHeight,
  chartMargin,
  data,
  isCompactChart,
  valueDomain,
  valueLabelFontSize,
  vista,
  xAxisTickCount,
  yAxisTickMargin,
  yAxisWidth,
}: RevenueByCategoryChartProps) {
  return (
    <div className={`h-full w-full transition-all duration-200 ease-out will-change-transform ${animationClass}`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={chartMargin}>
          <XAxis
            type="number"
            domain={valueDomain}
            allowDecimals={vista.id === "margen"}
            tickCount={xAxisTickCount}
            stroke={axisColor}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              vista.id === "ganancia"
                ? `$${Math.round(Number(value))}`
                : `${Math.round(Number(value))}%`
            }
            tick={{ fill: axisColor }}
          />
          <YAxis
            type="category"
            dataKey="categoria"
            stroke={labelColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            width={yAxisWidth}
            tickMargin={yAxisTickMargin}
            tick={{ fill: labelColor }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: "6px",
              color: tooltipText,
            }}
            labelStyle={{ color: tooltipText }}
            itemStyle={{ color: tooltipText }}
            wrapperStyle={{ maxWidth: isCompactChart ? 180 : undefined }}
            formatter={(value: number | undefined) => {
              const v = value ?? 0;
              const formatted =
                vista.id === "ganancia"
                  ? `$${v.toFixed(2)} USD`
                  : `${v.toFixed(1)}%`;
              return [formatted, vista.tooltipLabel];
            }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
          />
          <Bar
            dataKey="valor"
            radius={[0, 12, 12, 0]}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            barSize={20}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.valor < 0
                    ? NEGATIVE_REVENUE_COLOR
                    : REVENUE_CATEGORY_COLORS[index % REVENUE_CATEGORY_COLORS.length]
                }
              />
            ))}
            <LabelList
              dataKey="valor"
              content={(props) =>
                renderValueLabel({
                  formatValue: (value) =>
                    vista.id === "ganancia"
                      ? `$${value.toLocaleString()}`
                      : `${value.toFixed(1)}%`,
                  props,
                  valueLabelFontSize,
                })
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function renderValueLabel({
  formatValue,
  props,
  valueLabelFontSize,
}: {
  formatValue: (value: number) => string;
  props: LabelProps;
  valueLabelFontSize: number;
}) {
  const xNum = Number(props.x);
  const yNum = Number(props.y);
  const widthNum = Number(props.width);
  const heightNum = Number(props.height);
  const numericValue = typeof props.value === "number" ? props.value : Number(props.value ?? 0);
  if (!Number.isFinite(xNum) || !Number.isFinite(yNum) || !Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
    return "";
  }
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const isNegative = safeValue < 0;
  const barEnd = Math.max(xNum, xNum + widthNum);
  const barStart = Math.min(xNum, xNum + widthNum);
  const labelX = isNegative ? barStart - VALUE_LABEL_GAP : barEnd + VALUE_LABEL_GAP;
  const labelY = yNum + heightNum / 2 + 4;

  return (
    <text
      x={labelX}
      y={labelY}
      fill={isNegative ? NEGATIVE_REVENUE_COLOR : labelColor}
      stroke={tooltipBg}
      strokeWidth={3}
      paintOrder="stroke"
      fontSize={valueLabelFontSize}
      fontWeight={700}
      textAnchor={isNegative ? "end" : "start"}
    >
      {formatValue(safeValue)}
    </text>
  );
}
