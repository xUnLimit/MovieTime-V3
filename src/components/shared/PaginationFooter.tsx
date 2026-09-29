'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/platform/utils';
import { ChevronDown } from 'lucide-react';

export interface PaginationFooterProps {
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Oculta el selector de filas por pagina (cuando las filas se ajustan solas al alto disponible). */
  showPageSize?: boolean;
  className?: string;
}

/** Pie de paginacion unico de todas las tablas. */
export function PaginationFooter({
  page,
  totalPages,
  hasPrevious,
  hasMore,
  onPrevious,
  onNext,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  showPageSize = true,
  className,
}: PaginationFooterProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className ?? 'px-2 py-4')}>
      {showPageSize ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">Mostrar</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!onPageSizeChange}>
              <Button variant="outline" size="sm" className="w-16 justify-between px-2" aria-label="Filas por página">
                {pageSize}
                <ChevronDown className="size-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {pageSizeOptions.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => onPageSizeChange?.(size)}
                  className={pageSize === size ? 'bg-accent' : ''}
                >
                  {size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <span />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          Página {safePage} de {safeTotalPages}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPrevious || safePage === 1}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasMore || safePage === safeTotalPages}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
