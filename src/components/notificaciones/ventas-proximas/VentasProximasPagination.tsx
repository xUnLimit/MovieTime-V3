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
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mostrar</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-[70px] px-2 justify-between"
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

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Página {safeCurrentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousPage}
            disabled={safeCurrentPage === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
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
