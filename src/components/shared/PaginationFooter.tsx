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
}: PaginationFooterProps) {
  return (
    <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
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
            {[10, 25, 50].map((size) => (
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

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:gap-4">
        <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
          Página {page} de {totalPages}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onNext}
            disabled={!hasMore}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
