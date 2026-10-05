import React, { memo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/platform/utils';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Oculta la columna por debajo de este breakpoint: la tabla se adapta al ancho en vez de hacer scroll lateral. */
  hideBelow?: Breakpoint;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  pagination?: boolean;
  itemsPerPageOptions?: number[];
  /** Ajusta las filas por pagina al alto disponible para que la pagina no haga scroll vertical. */
  autoPageSize?: boolean;
  /** Alto estimado de una fila cuando es mayor al estandar (celdas de dos lineas); solo con `autoPageSize`. */
  rowHeight?: number;
  /** Sin borde ni radio propios: para vivir dentro de `TableCard`. */
  bare?: boolean;
  fixedLayout?: boolean;
  containerClassName?: string;
  tableClassName?: string;
}

export function defineDataTableColumns<T extends object>(columns: Column<T>[]): Column<T>[] {
  return columns;
}

export type SortDirection = 'asc' | 'desc' | null;
type SortableValue = string | number | boolean | Date | null | undefined;

/**
 * Las columnas secundarias aparecen segun el ancho de la propia tabla (container query) y no el de la ventana:
 * asi el menu lateral, que ocupa parte del ancho, no rompe el calculo.
 */
const HIDE_BELOW: Record<Breakpoint, string> = {
  sm: 'hidden @min-[30rem]:table-cell',
  md: 'hidden @min-[40rem]:table-cell',
  lg: 'hidden @min-[50rem]:table-cell',
  xl: 'hidden @min-[60rem]:table-cell',
  '2xl': 'hidden @min-[72rem]:table-cell',
  '3xl': 'hidden @min-[100rem]:table-cell',
};

// Un <col> debe conservar display: table-column, no el display de una celda.
export const HIDE_COLUMN: Record<Breakpoint, string> = {
  sm: 'hidden @min-[30rem]:table-column',
  md: 'hidden @min-[40rem]:table-column',
  lg: 'hidden @min-[50rem]:table-column',
  xl: 'hidden @min-[60rem]:table-column',
  '2xl': 'hidden @min-[72rem]:table-column',
  '3xl': 'hidden @min-[100rem]:table-column',
};

/** Clase para ocultar una celda de una tabla propia por debajo de cierto ancho de su contenedor. */
export function hideBelowClass(breakpoint: Breakpoint) {
  return HIDE_BELOW[breakpoint];
}

export function columnClass<T>(column: Column<T>, index: number) {
  return cn(
    index === 0 && 'pl-4',
    column.align === 'center' && 'text-center',
    column.align === 'right' && 'text-right',
    column.hideBelow && HIDE_BELOW[column.hideBelow]
  );
}

export function getCellValue<T extends object>(item: T, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

export function getRowKey<T extends object>(item: T, fallback: number) {
  const id = getCellValue(item, 'id');
  return typeof id === 'string' || typeof id === 'number' ? id : fallback;
}

export function toSortableValue(value: unknown): SortableValue {
  return value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : null;
}

// Fila memoizada para rendimiento
function DataTableRow<T extends object>({
  item,
  columns,
  actions,
  onRowClick,
}: {
  item: T;
  columns: Column<T>[];
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
}) {
  return (
    <TableRow
      onClick={() => onRowClick?.(item)}
      className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
    >
      {columns.map((column, colIndex) => (
        <TableCell key={column.key} className={columnClass(column, colIndex)}>
          {column.render ? column.render(item) : (getCellValue(item, column.key) as React.ReactNode)}
        </TableCell>
      ))}
      {actions && (
        <TableCell className="w-24 pr-4 text-center" onClick={(e) => e.stopPropagation()}>
          {actions(item)}
        </TableCell>
      )}
    </TableRow>
  );
}

export const MemoizedTableRow = memo(DataTableRow) as typeof DataTableRow;

