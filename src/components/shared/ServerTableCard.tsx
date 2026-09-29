'use client';

import { useEffect } from 'react';

import { settleFitRows, useFitPageSize } from '@/hooks/useFitPageSize';

import { PaginationFooter, type PaginationFooterProps } from './PaginationFooter';
import { TableCard, type TableCardProps } from './TableCard';

interface ServerTableCardProps extends Omit<TableCardProps, 'footer' | 'bodyRef'> {
  /** Paginacion del servidor; sin ella la tabla no muestra pie. */
  pagination?: PaginationFooterProps;
  rowCount: number;
  loading?: boolean;
  /** Alto estimado de una fila cuando es mayor al estandar (filas con varias lineas). */
  rowHeight?: number;
}

/**
 * `TableCard` para tablas paginadas en servidor: calcula cuantas filas caben en el alto disponible,
 * se lo comunica al controlador de la pagina (`onPageSizeChange`) y pinta el pie de paginacion estandar.
 */
export function ServerTableCard({ pagination, rowCount, loading = false, rowHeight, children, ...card }: ServerTableCardProps) {
  const onPageSizeChange = pagination?.onPageSizeChange;
  const pageSize = pagination?.pageSize;
  const { ref: bodyRef, rows: fitRows } = useFitPageSize({
    enabled: Boolean(onPageSizeChange),
    rowHeight,
    remeasureKey: `${loading}-${rowCount}-${pageSize}`,
  });

  useEffect(() => {
    if (fitRows === null || !onPageSizeChange) return;
    const next = settleFitRows(pageSize, fitRows);
    if (next !== pageSize) onPageSizeChange(next);
  }, [fitRows, onPageSizeChange, pageSize]);

  return (
    <TableCard
      {...card}
      bodyRef={bodyRef}
      footer={
        pagination && !loading && rowCount > 0 ? (
          <PaginationFooter {...pagination} showPageSize={false} className="p-0" />
        ) : undefined
      }
    >
      {children}
    </TableCard>
  );
}
