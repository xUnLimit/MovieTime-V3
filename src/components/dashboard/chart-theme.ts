import type { CSSProperties } from 'react';

/**
 * Tema unico de graficos del dashboard. Solo tokens de `globals.css`:
 * recharts los acepta como `var(--token)` en stroke/fill, asi el claro/oscuro se resuelve solo.
 */
export const chartColors = {
  income: 'var(--chart-1)',
  expense: 'var(--danger)',
  clients: 'var(--chart-2)',
  resellers: 'var(--chart-5)',
  gain: 'var(--success)',
  loss: 'var(--danger)',
  axis: 'var(--muted-foreground)',
  grid: 'var(--border)',
  label: 'var(--foreground)',
  surface: 'var(--card)',
} as const;

/** Paleta de categorias (barras): colores de serie, sin colores propios. */
export const categoryPalette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/**
 * Tamano inicial de los ResponsiveContainer con alto en porcentaje. Sin el, recharts avisa
 * "width(-1) and height(-1)" en el primer render, antes de medir el contenedor real.
 */
export const chartInitialDimension = { width: 320, height: 240 } as const;

export const chartTooltipStyle: CSSProperties = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
  color: 'var(--popover-foreground)',
  fontSize: '12px',
  padding: '8px 10px',
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 600,
  marginBottom: 4,
};
