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
    <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mostrar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!onPageSizeChange}>
            <Button variant="outline" size="sm" className="h-8 w-[70px] px-2 justify-between">
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

      <div className="flex items-center justify-between sm:justify-end gap-4">
        <span className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
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
