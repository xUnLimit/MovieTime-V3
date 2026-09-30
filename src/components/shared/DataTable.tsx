'use client';

import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { settleFitRows, useFitPageSize } from '@/hooks/use-fit-page-size';
import { cn } from '@/platform/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';
import { PaginationFooter } from './PaginationFooter';

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

type SortDirection = 'asc' | 'desc' | null;
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

/** Clase para ocultar una celda de una tabla propia por debajo de cierto ancho de su contenedor. */
export function hideBelowClass(breakpoint: Breakpoint) {
  return HIDE_BELOW[breakpoint];
}

function columnClass<T>(column: Column<T>, index: number) {
  return cn(
    index === 0 && 'pl-4',
    column.align === 'center' && 'text-center',
    column.align === 'right' && 'text-right',
    column.hideBelow && HIDE_BELOW[column.hideBelow]
  );
}

function getCellValue<T extends object>(item: T, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

function getRowKey<T extends object>(item: T, fallback: number) {
  const id = getCellValue(item, 'id');
  return typeof id === 'string' || typeof id === 'number' ? id : fallback;
}

function toSortableValue(value: unknown): SortableValue {
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
  index: number;
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
        <TableCell className="w-14 pr-4 text-center" onClick={(e) => e.stopPropagation()}>
          {actions(item)}
        </TableCell>
      )}
    </TableRow>
  );
}

const MemoizedTableRow = memo(DataTableRow) as typeof DataTableRow;

function DataTableComponent<T extends object>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
  actions,
  pagination = false,
  itemsPerPageOptions = [10, 25, 50, 100],
  autoPageSize = false,
  rowHeight,
  bare = false,
  fixedLayout = false,
  containerClassName,
  tableClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const autoFit = autoPageSize && pagination;

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = toSortableValue(getCellValue(a, sortKey));
      const bValue = toSortableValue(getCellValue(b, sortKey));

      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const {
    data: paginatedData,
    page,
    totalPages,
    hasPrevious,
    hasMore,
    pageSize,
    setPageSize,
    next,
    previous,
    reset,
  } = useClientPagination({
    data: sortedData,
    initialPageSize: itemsPerPageOptions[0],
  });

  const { ref: fitRef, rows: fitRows } = useFitPageSize({ enabled: autoFit, rowHeight, remeasureKey: `${loading}-${data.length}-${pageSize}` });
  useEffect(() => {
    if (autoFit && fitRows !== null && settleFitRows(pageSize, fitRows) !== pageSize) setPageSize(fitRows);
  }, [autoFit, fitRows, pageSize, setPageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Misma columna: ciclar asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      // Nueva columna: empezar con asc
      setSortKey(key);
      setSortDirection('asc');
    }
    reset();
  };

  const handleItemsPerPageChange = useCallback((size: number) => {
    setPageSize(size);
  }, [setPageSize]);

  const getSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="ml-1.5 size-3.5 opacity-40" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-1.5 size-3.5" />;
    }
    return <ArrowDown className="ml-1.5 size-3.5" />;
  };

  const frameClass = cn('min-w-0', !bare && 'overflow-hidden rounded-lg border bg-card', containerClassName);

  if (loading) {
    return (
      <div ref={fitRef} className="@container">
        <div className={frameClass} aria-busy="true">
          <div className="space-y-px">
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                {columns.slice(0, 4).map((column) => (
                  <Skeleton key={column.key} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>
          <span className="sr-only">Cargando datos…</span>
        </div>
      </div>
    );
  }

  const displayData = pagination ? paginatedData : sortedData;

  return (
    <div ref={fitRef} className="@container">
      <div className={frameClass}>
        <Table className={cn(fixedLayout && 'table-fixed', tableClassName)}>
          {fixedLayout ? (
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} className={column.hideBelow ? HIDE_BELOW[column.hideBelow] : undefined} style={{ width: column.width }} />
              ))}
              {actions ? <col className="w-14" /> : null}
            </colgroup>
          ) : null}
          <TableHeader>
            <TableRow>
              {columns.map((column, colIndex) => (
                <TableHead
                  key={column.key}
                  style={fixedLayout ? undefined : { width: column.width }}
                  className={columnClass(column, colIndex)}
                >
                  {column.headerRender ? (
                    column.headerRender()
                  ) : column.sortable ? (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.key)}
                      className={cn(
                        'h-8 -ml-3 px-3 text-xs font-medium',
                        column.align === 'center' && 'ml-0 w-full justify-center',
                        column.align === 'right' && '-mr-3 ml-auto',
                        sortKey === column.key ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {column.header}
                      {getSortIcon(column.key)}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">{column.header}</span>
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="w-14 pr-4 text-center text-muted-foreground">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.length > 0 ? (
              displayData.map((item, index) => (
                <MemoizedTableRow
                  key={getRowKey(item, index)}
                  item={item}
                  columns={columns}
                  actions={actions}
                  onRowClick={onRowClick}
                  index={index}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="py-10"
                >
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          hasPrevious={hasPrevious}
          hasMore={hasMore}
          onPrevious={previous}
          onNext={next}
          pageSize={pageSize}
          onPageSizeChange={handleItemsPerPageChange}
          pageSizeOptions={itemsPerPageOptions}
          showPageSize={!autoFit}
          className={bare ? 'border-t px-4 py-2' : undefined}
        />
      )}
    </div>
  );
}

// Export memoized version of DataTable
export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;
