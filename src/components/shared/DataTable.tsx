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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

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
}

type SortDirection = 'asc' | 'desc' | null;

// Memoized TableRow component for better performance
const MemoizedTableRow = memo(function MemoizedTableRow<T extends Record<string, unknown>>({
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
          {column.render ? column.render(item) : (item[column.key] as React.ReactNode)}
        </TableCell>
      ))}
      {actions && (
        <TableCell className="text-center pr-6" onClick={(e) => e.stopPropagation()}>
          {actions(item)}
        </TableCell>
      )}
    </TableRow>
  );
});

function DataTableComponent<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
  actions,
  pagination = false,
  itemsPerPageOptions = [10, 25, 50, 100],
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[0]);

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
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey] as string | number | boolean;
      const bValue = b[sortKey] as string | number | boolean;

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  // Pagination logic
  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    return Math.ceil(sortedData.length / itemsPerPage);
  }, [pagination, sortedData.length, itemsPerPage]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [pagination, sortedData, currentPage, itemsPerPage]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handleItemsPerPageChange = useCallback((value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  }, []);

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

  const displayData = paginatedData;

  return (
    <div>
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
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
                  key={(item.id as string) || index}
                  item={item}
                  columns={columns as Column<Record<string, unknown>>[]}
                  actions={actions as ((item: Record<string, unknown>) => React.ReactNode) | undefined}
                  onRowClick={onRowClick as ((item: Record<string, unknown>) => void) | undefined}
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
        <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-[70px] px-2 justify-between">
                  {itemsPerPage}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {itemsPerPageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => handleItemsPerPageChange(option.toString())}
                    className={itemsPerPage === option ? 'bg-accent' : ''}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized version of DataTable
export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;
