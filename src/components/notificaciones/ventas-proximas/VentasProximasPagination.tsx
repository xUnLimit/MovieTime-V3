import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ITEMS_PER_PAGE_OPTIONS } from './helpers';

interface VentasProximasPaginationProps {
  itemsPerPage: number;
  safeCurrentPage: number;
  totalPages: number;
  onItemsPerPageChange: (value: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function VentasProximasPagination({
  itemsPerPage,
  safeCurrentPage,
  totalPages,
  onItemsPerPageChange,
  onPreviousPage,
  onNextPage,
}: VentasProximasPaginationProps) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-3 px-2 py-2 sm:gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground sm:text-sm">Mostrar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-[62px] justify-between px-2 sm:w-[70px]"
            >
              {itemsPerPage}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ITEMS_PER_PAGE_OPTIONS.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onItemsPerPageChange(size.toString())}
                className={itemsPerPage === size ? 'bg-accent' : ''}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
          Página {safeCurrentPage} de {totalPages}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onPreviousPage}
            disabled={safeCurrentPage === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
            onClick={onNextPage}
            disabled={safeCurrentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
