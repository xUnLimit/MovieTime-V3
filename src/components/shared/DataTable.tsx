'use client';

import React, { useState, useMemo, memo, useCallback } from 'react';
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
import { useClientPagination } from '@/hooks/useClientPagination';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { PaginationFooter } from './PaginationFooter';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
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
  fixedLayout?: boolean;
  containerClassName?: string;
  tableClassName?: string;
}

export function defineDataTableColumns<T extends object>(columns: Column<T>[]): Column<T>[] {
  return columns;
}

type SortDirection = 'asc' | 'desc' | null;
type SortableValue = string | number | boolean | Date | null | undefined;

function getDefaultMinTableWidth(columnCount: number, hasActions: boolean) {
  const effectiveColumns = columnCount + (hasActions ? 1 : 0);
  return Math.max(720, effectiveColumns * 140);
}

// Memoized TableRow component for better performance
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
        <TableCell
          key={column.key}
          className={`${colIndex === 0 ? 'pl-6' : ''} ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
        >
          {column.render ? column.render(item) : (getCellValue(item, column.key) as React.ReactNode)}
        </TableCell>
      ))}
      {actions && (
        <TableCell className="text-center pr-6" onClick={(e) => e.stopPropagation()}>
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
  fixedLayout = false,
  containerClassName,
  tableClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const displayData = pagination ? paginatedData : sortedData;
  const hasExplicitMinWidth = /\bmin-w-/.test(tableClassName ?? '');
  const tableStyle = hasExplicitMinWidth
    ? undefined
    : { minWidth: `max(100%, ${getDefaultMinTableWidth(columns.length, Boolean(actions))}px)` };

  return (
    <div>
      <div className={`min-w-0 rounded-md border bg-background ${containerClassName ?? ''}`}>
        <Table
          className={[fixedLayout ? 'table-fixed' : '', tableClassName].filter(Boolean).join(' ') || undefined}
          style={tableStyle}
        >
          {fixedLayout ? (
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
              {actions ? <col /> : null}
            </colgroup>
          ) : null}
          <TableHeader>
            <TableRow>
              {columns.map((column, colIndex) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={`${colIndex === 0 ? 'pl-6' : ''} ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
                >
                  {column.headerRender ? (
                    column.headerRender()
                  ) : column.sortable ? (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.key)}
                      className={`h-8 -ml-3 ${column.align === 'center' ? 'w-full justify-center ml-0' : ''} ${sortKey === column.key ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {column.header}
                      {getSortIcon(column.key)}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">{column.header}</span>
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="text-center pr-6 text-muted-foreground">Acciones</TableHead>}
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
        />
      )}
    </div>
  );
}

// Export memoized version of DataTable
export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;
