import { useSyncExternalStore } from "react";

export const REVENUE_CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#14b8a6",
];

export const NEGATIVE_REVENUE_COLOR = "#dc2626";
export const MIN_NEGATIVE_AXIS_RATIO = 0.05;
export const MIN_NEGATIVE_AXIS_RATIO_MOBILE = 0.12;
export const VALUE_LABEL_GAP = 8;

const COMPACT_CHART_QUERY = "(max-width: 640px)";

export type RevenueCategoryView = "ganancia" | "margen";

export const REVENUE_CATEGORY_VIEWS: Array<{
  id: RevenueCategoryView;
  title: string;
  description: string;
  tooltipLabel: string;
}> = [
  {
    id: "ganancia",
    title: "Ganancia Neta por Categoria",
    description: "Ganancia neta generada por cada categoria de servicio.",
    tooltipLabel: "Ganancia neta",
  },
  {
    id: "margen",
    title: "Rentabilidad por Categoria",
    description:
      "Margen porcentual de ganancia sobre los ingresos de cada categoria.",
    tooltipLabel: "Rentabilidad",
  },
];

export function useIsCompactChart() {
  return useSyncExternalStore(
    subscribeToCompactChart,
    getIsCompactChart,
    () => false,
  );
}

function subscribeToCompactChart(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(COMPACT_CHART_QUERY);
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function getIsCompactChart() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(COMPACT_CHART_QUERY).matches
  );
}

export function getValueDomain(
  data: Array<{ valor: number }>,
  minNegativeAxisRatio: number,
): [number, number] {
  const maxPositive = Math.max(0, ...data.map((entry) => entry.valor));
  const minNegative = Math.min(0, ...data.map((entry) => entry.valor));

  if (minNegative >= 0) {
    return [0, maxPositive];
  }

  if (maxPositive <= 0) {
    return [minNegative, 0];
  }

  const visibleNegativeRange = Math.max(
    Math.abs(minNegative),
    maxPositive * minNegativeAxisRatio,
  );

  return [-visibleNegativeRange, maxPositive];
}
