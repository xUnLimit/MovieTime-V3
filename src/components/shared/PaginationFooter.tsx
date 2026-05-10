'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  className?: string;
}

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
  className = 'px-2 py-4',
}: PaginationFooterProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <div className={`flex flex-row flex-wrap items-center justify-between gap-3 sm:gap-2 ${className}`}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground sm:text-sm">Mostrar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!onPageSizeChange}>
            <Button variant="outline" size="sm" className="h-8 w-[62px] justify-between px-2 sm:w-[70px]">
              {pageSize}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
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

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
          Página {safePage} de {safeTotalPages}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onPrevious}
            disabled={!hasPrevious || safePage === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onNext}
            disabled={!hasMore || safePage === safeTotalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
